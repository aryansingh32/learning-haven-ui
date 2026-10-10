import { Request, Response } from 'express';
import { z } from 'zod';
import { CompareMode, isCompareMode } from '@repo/assessment-core';
import { AuthRequest } from '../../../middleware/auth';
import logger from '../../../config/logger';
import { CourseAccessService } from '../services/courseAccess.service';
import {
    functionHint, JUDGED_LANGUAGES, judgeSolution, JudgeUnavailableError,
} from '../../execution/services/problemJudge.service';
import { ProblemsService } from '../services/problems.service';
import { StatusService } from '../services/status.service';
import { SubmissionsService } from '../services/submissions.service';
import { SubmissionHistoryService } from '../services/submissionHistory.service';
import { EditorPrefsService, RunHistoryService } from '../services/runHistory.service';
import { browserRunSchema, editorPrefsSchema, isBadReference, isMissingRelation, runBodySchema, shapeCustomRun } from '../services/practiceRuns';

const judgeBody = z.object({
    code: z.string().min(1, 'Write some code first.').max(50_000, 'Code exceeds the 50 KB limit.'),
    language: z.enum(JUDGED_LANGUAGES),
});

const statusBody = z.object({ status: z.enum(['solved', 'tried', 'revision']) });

/** Premium problems need any paid plan — the same rule as premium courses. */
export async function hasPaidPlan(userId: string): Promise<boolean> {
    return CourseAccessService.hasPaidPlan(userId);
}

export class JudgeController {
    /**
     * POST /api/problems/:id/judge
     * Judge a solution on every test (hidden included). Solve + XP only when all pass.
     */
    static async judge(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id as string;
        const problemId = req.params.id as string;
        const parsed = judgeBody.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request' });
        const { code, language } = parsed.data;

        try {
            const data = await ProblemsService.getJudgeData(problemId, userId);
            if (!data) return res.status(404).json({ error: 'Problem not found' });
            const { problem, tests } = data;
            if (problem.is_premium && !(await hasPaidPlan(userId))) {
                return res.status(403).json({ error: 'This problem is part of Forge Pro.', code: 'PREMIUM_REQUIRED' });
            }
            if (tests.length === 0) return res.status(409).json({ error: 'This problem has no tests yet, so it can\'t be judged.' });

            const compare: CompareMode = isCompareMode(problem.judge_config?.compare) ? problem.judge_config.compare : 'exact';
            const result = await judgeSolution({
                code,
                language,
                compare,
                hint: functionHint(language, problem.starter_code?.[language]),
                tests: tests.map((t) => ({ input: t.input, expected: t.expected_output, isSample: t.is_sample })),
            });

            await SubmissionHistoryService.record({
                userId, problemId, language, code,
                verdict: result.verdict, passed: result.passed, total: result.total, timeMs: result.timeMs, memoryKb: result.memoryKb,
            });

            let xpGained = 0;
            let firstSolve = false;
            if (result.verdict === 'Accepted') {
                const submission = await SubmissionsService.submitSolution(userId, problemId, code, language);
                xpGained = submission.xp_gained;
                firstSolve = submission.is_first_solve;
                await StatusService.updateStatus(userId, problemId, 'solved');
            } else {
                // First failed attempt marks it "tried"; never downgrade solved / revision.
                const current = await StatusService.getStatus(userId, problemId).catch(() => null);
                if (!current) await StatusService.updateStatus(userId, problemId, 'tried');
            }
            await ProblemsService.invalidateProblemCache(problem.slug, userId);

            return res.json({ ...result, xpGained, firstSolve });
        } catch (err) {
            if (err instanceof JudgeUnavailableError) return res.status(503).json({ error: err.message, code: 'JUDGE_UNAVAILABLE' });
            logger.error('Judge request failed', { problemId, error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not judge your solution. Please try again.' });
        }
    }

    /**
     * POST /api/problems/:id/run
     * Run a solution on the server, on the SAMPLE tests — or on one custom input the
     * learner typed (optionally with the output they expect). For languages the
     * browser can't run (C++, Java). Never records a solve, status or XP; the run
     * is kept in the learner's run history.
     */
    static async run(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id as string;
        const problemId = req.params.id as string;
        const parsed = runBodySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request' });
        const { code, language, input, expected } = parsed.data;

        try {
            const data = await ProblemsService.getJudgeData(problemId, userId);
            if (!data) return res.status(404).json({ error: 'Problem not found' });
            const { problem, tests } = data;
            if (problem.is_premium && !(await hasPaidPlan(userId))) {
                return res.status(403).json({ error: 'This problem is part of Forge Pro.', code: 'PREMIUM_REQUIRED' });
            }
            const samples = tests.filter((t) => t.is_sample);
            if (input === undefined && samples.length === 0) return res.status(409).json({ error: 'This problem has no sample tests to run.' });

            const compare: CompareMode = isCompareMode(problem.judge_config?.compare) ? problem.judge_config.compare : 'exact';
            const result = await judgeSolution({
                code,
                language,
                compare,
                hint: functionHint(language, problem.starter_code?.[language]),
                tests: input !== undefined
                    ? [{ input, expected: expected ?? '', isSample: true }]
                    : samples.map((t) => ({ input: t.input, expected: t.expected_output, isSample: true })),
            });

            if (input !== undefined) {
                const custom = shapeCustomRun(result, input, expected);
                await RunHistoryService.recordQuietly({
                    userId, problemId, language, source: 'server', kind: 'custom', code, input,
                    output: custom.custom.output ?? custom.custom.error, verdict: custom.verdict,
                    passed: custom.passed, total: custom.total, timeMs: result.timeMs, memoryKb: result.memoryKb,
                });
                return res.json(custom);
            }
            await RunHistoryService.recordQuietly({
                userId, problemId, language, source: 'server', kind: 'examples', code, output: result.message ?? null,
                verdict: result.verdict, passed: result.passed, total: result.total, timeMs: result.timeMs, memoryKb: result.memoryKb,
            });
            return res.json(result);
        } catch (err) {
            if (err instanceof JudgeUnavailableError) return res.status(503).json({ error: err.message, code: 'JUDGE_UNAVAILABLE' });
            logger.error('Run request failed', { problemId, error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not run your code. Please try again.' });
        }
    }

    /**
     * GET /api/problems/:id/runs
     * The learner's recent runs on this problem (browser and server), newest first.
     */
    static async runs(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id as string;
        try {
            return res.json({ runs: await RunHistoryService.list(userId, req.params.id as string) });
        } catch (err) {
            if (isBadReference(err)) return res.json({ runs: [] });
            logger.error('Run history failed', { problemId: req.params.id, error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not load your runs.' });
        }
    }

    /**
     * POST /api/problems/:id/runs
     * Keep a run the browser did (JavaScript / Python) in the learner's history.
     * History only: nothing here counts toward a solve, status or XP.
     */
    static async reportRun(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id as string;
        const problemId = req.params.id as string;
        const parsed = browserRunSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid run' });
        const r = parsed.data;
        try {
            await RunHistoryService.record({
                userId, problemId, language: r.language, source: 'browser', kind: r.kind, code: r.code, input: r.input ?? null,
                output: r.output ?? null, verdict: r.verdict, passed: r.passed, total: r.total, timeMs: r.time_ms ?? null,
            });
            return res.status(201).json({ ok: true });
        } catch (err) {
            if (isBadReference(err)) return res.status(404).json({ error: 'Problem not found' });
            if (isMissingRelation(err)) return res.status(202).json({ ok: false, reason: 'Run history is not available yet.' });
            return res.status(500).json({ error: 'Could not keep this run.' });
        }
    }

    /** GET /api/users/me/editor-preferences */
    static async getEditorPrefs(req: Request, res: Response) {
        try {
            return res.json(await EditorPrefsService.get((req as AuthRequest).user!.id as string));
        } catch (err) {
            logger.error('Editor preferences failed', { error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not load your editor settings.' });
        }
    }

    /** PUT /api/users/me/editor-preferences — theme, font size (11–24), word wrap. */
    static async saveEditorPrefs(req: Request, res: Response) {
        const parsed = editorPrefsSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings' });
        try {
            return res.json(await EditorPrefsService.save((req as AuthRequest).user!.id as string, parsed.data));
        } catch (err) {
            if (isMissingRelation(err)) return res.status(503).json({ error: 'Editor settings can not be saved on this server yet.' });
            logger.error('Saving editor preferences failed', { error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not save your editor settings.' });
        }
    }

    /**
     * GET /api/problems/:id/submissions
     * The learner's own judged submissions for this problem, newest first.
     */
    static async history(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id as string;
        try {
            return res.json({ submissions: await SubmissionHistoryService.list(userId, req.params.id as string) });
        } catch (err) {
            logger.error('Submission history failed', { problemId: req.params.id, error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not load your submissions.' });
        }
    }

    /**
     * POST /api/problems/:id/status
     * Track tried / revision. "Solved" is only self-reported for problems the judge can't check.
     */
    static async setStatus(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id as string;
        const problemId = req.params.id as string;
        const parsed = statusBody.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Status must be solved, tried or revision.' });

        try {
            const data = await ProblemsService.getJudgeData(problemId, userId);
            if (!data) return res.status(404).json({ error: 'Problem not found' });
            if (parsed.data.status === 'solved' && data.tests.length > 0) {
                return res.status(409).json({ error: 'Submit your code to mark this problem solved.', code: 'JUDGE_REQUIRED' });
            }
            const status = await StatusService.updateStatus(userId, problemId, parsed.data.status);
            await ProblemsService.invalidateProblemCache(data.problem.slug, userId);
            return res.json(status);
        } catch (err) {
            logger.error('Set problem status failed', { problemId, error: err instanceof Error ? err.message : String(err) });
            return res.status(500).json({ error: 'Could not update the status.' });
        }
    }
}
