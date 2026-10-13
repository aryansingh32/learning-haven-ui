import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { ChaptersService } from '../services/chapters.service';
import logger from '../../../config/logger';
import { pool } from '../../../config/database';
import { LearningGateService } from '../services/learningGate.service';
import { gradeQuiz, loadChapterQuiz } from '../services/chapterQuiz';

const router = Router();

/**
 * POST /api/chapters/:chapterId/quiz/submit  { answers: number[] }  (-1 = skipped)
 * Grades the whole quiz on the server, records the best score, and returns the
 * result per question (right option and explanation). The browser never sees the
 * answers before submitting, and can't report its own score.
 */
router.post('/:chapterId/quiz/submit', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!Array.isArray(req.body?.answers) || req.body.answers.length > 200) {
            return res.status(400).json({ error: 'answers must be a list of chosen option numbers' });
        }
        if (!(await LearningGateService.allowChapterWrite(userId, chapterId, res))) return;
        const questions = await loadChapterQuiz(chapterId);
        if (!questions.length) return res.status(404).json({ error: 'This chapter has no quiz' });
        const graded = gradeQuiz(questions, req.body.answers);
        const detail = questions.map((q, i) => ({
            question: String(q.question ?? q.q ?? ''),
            options: Array.isArray(q.options) ? q.options.map(String) : [],
            selected_index: graded.results[i].selectedIndex,
            selected_text: graded.results[i].selectedIndex >= 0 ? String((q.options as unknown[])[graded.results[i].selectedIndex]) : '',
            is_correct: graded.results[i].correct,
            correct_option: graded.results[i].correctOption,
            explanation: graded.results[i].explanation,
        }));
        const saved = await ChaptersService.updateQuizProgress(userId, chapterId, graded.percent, detail);
        return res.json({
            score: graded.score,
            total: graded.total,
            percent: graded.percent,
            passed: graded.passed,
            best_percent: saved.quiz_score,
            can_unlock: saved.can_unlock,
            results: graded.results,
        });
    } catch (err) {
        logger.error('Quiz submit error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/quiz/check  { questionIndex, selectedIndex }
 * One question, graded on the server (kept for older clients; nothing is saved).
 */
router.post('/:chapterId/quiz/check', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { questionIndex, selectedIndex } = req.body ?? {};
        if (typeof questionIndex !== 'number' || typeof selectedIndex !== 'number') {
            return res.status(400).json({ error: 'questionIndex and selectedIndex must be numbers' });
        }
        const questions = await loadChapterQuiz(chapterId);
        if (!questions.length) return res.status(404).json({ error: 'Quiz not found for this chapter' });
        const question = questions[questionIndex];
        if (!question) return res.status(400).json({ error: 'Question index out of range' });
        const [result] = gradeQuiz([question], [selectedIndex]).results;
        return res.json({ correct: result.correct, explanation: result.explanation, correctOption: result.correctOption });
    } catch (err) {
        logger.error('Quiz check error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/quiz  (older clients)
 * The score is worked out here from the chosen options (answers[].selected_index);
 * a score sent by the browser is ignored.
 */
router.post('/:chapterId/progress/quiz', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!(await LearningGateService.allowChapterWrite(userId, chapterId, res))) return;
        const questions = await loadChapterQuiz(chapterId);
        if (!questions.length) return res.status(404).json({ error: 'This chapter has no quiz' });
        const answers: unknown[] = Array.isArray(req.body?.answers) ? req.body.answers : [];
        const selected = answers.map((a: any) => (typeof a === 'number' ? a : a?.selected_index));
        const graded = gradeQuiz(questions, selected);
        const result = await ChaptersService.updateQuizProgress(userId, chapterId, graded.percent, answers);
        return res.json(result);
    } catch (err: any) {
        logger.error('Quiz progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/task
 * Submit a completed task response. Persists the learner's written answer.
 */
router.post('/:chapterId/progress/task', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        // BH-009: Read `notes` from request body — was previously never passed to the service
        const { notes } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Prerequisites and drip release are enforced here, not only in the UI.
        if (!(await LearningGateService.allowChapterWrite(userId, chapterId, res))) return;
        const result = await ChaptersService.updateTaskProgress(userId, chapterId, notes);
        return res.json(result);
    } catch (err) {
        logger.error('Task progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/task/draft
 * Auto-save a task draft without submitting. Safe to call on every keystroke (debounced client-side).
 */
router.post('/:chapterId/progress/task/draft', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { draft } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (typeof draft !== 'string') return res.status(400).json({ error: 'Missing draft string' });

        // Prerequisites and drip release are enforced here, not only in the UI.
        if (!(await LearningGateService.allowChapterWrite(userId, chapterId, res))) return;
        const result = await ChaptersService.saveTaskDraft(userId, chapterId, draft);
        return res.json(result);
    } catch (err) {
        logger.error('Task draft POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


/**
 * POST /api/chapters/:chapterId/progress/step
 */
router.post('/:chapterId/progress/step', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { step_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!step_id) return res.status(400).json({ error: 'Missing step_id' });

        // Prerequisites and drip release are enforced here, not only in the UI.
        if (!(await LearningGateService.allowChapterWrite(userId, chapterId, res))) return;
        const result = await ChaptersService.updateStepProgress(userId, chapterId, step_id);
        return res.json(result);
    } catch (err) {
        logger.error('Step progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/unlock
 */
router.post('/unlock', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapter_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!chapter_id) return res.status(400).json({ error: 'Missing chapter_id' });

        // Prerequisites and drip release are enforced here, not only in the UI.
        if (!(await LearningGateService.allowChapterWrite(userId, chapter_id, res))) return;
        const result = await ChaptersService.unlockChapter(userId, chapter_id);

        if (result.error) {
            return res.status(result.statusCode || 400).json(result);
        }

        return res.json(result);
    } catch (err: any) {
        logger.error('Unlock POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/skip-unlock
 */
router.post('/skip-unlock', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapter_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!chapter_id) return res.status(400).json({ error: 'Missing chapter_id' });

        // Prerequisites and drip release are enforced here, not only in the UI.
        if (!(await LearningGateService.allowChapterWrite(userId, chapter_id, res))) return;
        const result = await ChaptersService.skipUnlockChapter(userId, chapter_id);

        if (result.error) {
            return res.status(result.statusCode || 400).json(result);
        }

        return res.json(result);
    } catch (err) {
        logger.error('Skip-unlock POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/chapters/:chapterId/celebration
 */
router.get('/:chapterId/celebration', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const data = await ChaptersService.getCelebrationSummary(userId, chapterId);
        return res.json(data);
    } catch (err: any) {
        logger.error('Celebration GET error', err);
        if (err.message === 'Chapter not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

/**
 * GET /api/chapters/:chapterId
 * Fetch chapter + chapter_content from Supabase.
 * Also fetch user_chapter_progress for this user + chapter.
 * If no progress row exists: create one with status='LOCKED' (or UNLOCKED for ch1).
 */
router.get('/:chapterId', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = await ChaptersService.getChapterWithProgress(userId, chapterId);

        return res.json({
            chapter: data.chapter,
            course: data.course,
            content: data.content,
            progress: data.progress,
            gate: data.gate,
            celebration: data.celebration,
            user: data.user,
        });
    } catch (err: any) {
        logger.error('Chapter GET error', err);
        if (err.message === 'Chapter not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

export default router;
