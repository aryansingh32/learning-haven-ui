import { Router } from 'express';
import { z } from 'zod';
import { normalizePolicy, PROCTORING_EVENTS } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { finishCurrentSection, getAttemptView, heartbeat, recordEvent, resultsReleased, runSamples, saveAnswer, startAttempt, submitAttempt } from '../services/attempts';
import { JUDGED_LANGUAGES } from '../services/judge';

export const studentRouter = Router();
const uuid = z.string().uuid();

/** Published assignments for every batch I'm in, with my attempt status. */
studentRouter.get('/assignments', async (req, res) => {
  const userId = userOf(req);
  const rows = await asUser(userId, async (db) => {
    const { rows } = await db.query(
      `select a.id, a.title, a.instructions, a.opens_at, a.closes_at, a.max_attempts, a.result_release,
              a.results_released_at, a.duration_seconds, a.test_id, a.proctoring,
              o.name as org_name, b.name as batch_name,
              (select count(*) from public.test_attempts x where x.assignment_id = a.id and x.user_id = $1)::int as attempts_used,
              (select x.id from public.test_attempts x where x.assignment_id = a.id and x.user_id = $1
                 order by x.attempt_number desc limit 1) as latest_attempt_id,
              (select x.status from public.test_attempts x where x.assignment_id = a.id and x.user_id = $1
                 order by x.attempt_number desc limit 1) as latest_status,
              (select max(x.score) from public.test_attempts x where x.assignment_id = a.id and x.user_id = $1
                 and x.status = 'completed') as best_score,
              (select max(x.total_marks) from public.test_attempts x where x.assignment_id = a.id and x.user_id = $1) as total_marks
         from campus.assignments a
         join campus.organizations o on o.id = a.org_id
         join campus.batches b on b.id = a.batch_id
        where a.status = 'published' and campus.is_batch_member(a.batch_id)
        order by a.closes_at asc`,
      [userId]
    );
    return rows;
  });

  // College tests aren't readable by students, so durations come from a
  // system lookup restricted to the assignments RLS already showed them.
  const testIds = [...new Set(rows.map((r) => r.test_id))];
  const testInfo = new Map<string, { duration: number; sections: Array<{ name: string; minutes: number }> | null }>(
    testIds.length === 0 ? [] : await asSystem(async (db) => {
      const { rows: tests } = await db.query<{ id: string; duration_seconds: number; section_time_locked: boolean; sections: Array<{ name: string; seconds: number | null }> | null }>(
        `select t.id, t.duration_seconds, t.section_time_locked,
                (select json_agg(json_build_object('name', s.name, 'seconds', s.duration_seconds) order by s.sort_order, s.created_at)
                   from public.test_sections s where s.test_id = t.id
                    and exists (select 1 from public.test_questions tq where tq.section_id = s.id)) as sections
           from public.tests t where t.id = any($1::uuid[])`, [testIds]
      );
      return tests.map((t) => {
        const sections = t.section_time_locked && t.sections
          ? t.sections.map((x) => ({ name: x.name, minutes: Math.round((x.seconds ?? 0) / 60) }))
          : null;
        // Timed-section tests last exactly as long as their sections.
        const duration = sections ? (t.sections ?? []).reduce((sum, x) => sum + (x.seconds ?? 0), 0) : t.duration_seconds;
        return [t.id, { duration, sections }] as [string, { duration: number; sections: Array<{ name: string; minutes: number }> | null }];
      });
    }));

  const now = new Date();
  res.json(rows.map((r) => {
    const released = resultsReleased(r, now);
    return {
      id: r.id,
      title: r.title,
      instructions: r.instructions,
      college: r.org_name,
      batch: r.batch_name,
      opensAt: r.opens_at,
      closesAt: r.closes_at,
      durationMinutes: Math.round(((testInfo.get(r.test_id)?.sections ? testInfo.get(r.test_id)!.duration : r.duration_seconds ?? testInfo.get(r.test_id)?.duration) ?? 0) / 60),
      // So the student knows before starting: one section at a time, no going back.
      timedSections: testInfo.get(r.test_id)?.sections ?? null,
      state: now < new Date(r.opens_at) ? 'upcoming' : now >= new Date(r.closes_at) ? 'closed' : 'open',
      maxAttempts: r.max_attempts,
      attemptsUsed: r.attempts_used,
      latestAttemptId: r.latest_attempt_id,
      latestStatus: r.latest_status,
      resultsReleased: released,
      bestScore: released && r.best_score !== null ? Number(r.best_score) : null,
      totalMarks: released && r.total_marks !== null ? Number(r.total_marks) : null,
      // So the student knows the lockdown rules before pressing Start.
      proctoring: normalizePolicy(r.proctoring),
    };
  }));
});

studentRouter.post('/assignments/:id/start', async (req, res) => {
  const userId = userOf(req);
  res.status(201).json(await startAttempt(userId, uuid.parse(req.params.id)));
});

studentRouter.get('/attempts/:id', async (req, res) => {
  const userId = userOf(req);
  res.json(await getAttemptView(userId, uuid.parse(req.params.id)));
});

const answerBody = z.object({
  selectedOptions: z.array(z.string().min(1).max(64)).max(20).nullable().optional(),
  natValue: z.number().finite().nullable().optional(),
  code: z.string().max(50_000, 'Code exceeds the 50 KB limit.').nullable().optional(),
  language: z.enum(JUDGED_LANGUAGES).nullable().optional(),
  markedForReview: z.boolean().optional(),
});

studentRouter.put('/attempts/:id/answers/:questionId', async (req, res) => {
  const userId = userOf(req);
  res.json(await saveAnswer(userId, uuid.parse(req.params.id), uuid.parse(req.params.questionId), answerBody.parse(req.body)));
});

const runBody = z.object({
  code: z.string().min(1, 'Write some code first.').max(50_000, 'Code exceeds the 50 KB limit.'),
  language: z.enum(JUDGED_LANGUAGES),
});

/** Run code on the sample tests of a coding question. Doesn't save or score. */
studentRouter.post('/attempts/:id/questions/:questionId/run', async (req, res) => {
  const userId = userOf(req);
  res.json(await runSamples(userId, uuid.parse(req.params.id), uuid.parse(req.params.questionId), runBody.parse(req.body)));
});

/** "Still here" every 30 s while the exam is open, so invigilators see who dropped off. */
studentRouter.post('/attempts/:id/heartbeat', async (req, res) => {
  const userId = userOf(req);
  res.json(await heartbeat(userId, uuid.parse(req.params.id)));
});

/** Finish the current timed section early and move on (no going back). */
studentRouter.post('/attempts/:id/sections/finish', async (req, res) => {
  const userId = userOf(req);
  res.json(await finishCurrentSection(userId, uuid.parse(req.params.id)));
});

const eventBody = z.object({ type: z.enum(PROCTORING_EVENTS) });

studentRouter.post('/attempts/:id/events', async (req, res) => {
  const userId = userOf(req);
  res.json(await recordEvent(userId, uuid.parse(req.params.id), eventBody.parse(req.body).type));
});

studentRouter.post('/attempts/:id/submit', async (req, res) => {
  const userId = userOf(req);
  res.json(await submitAttempt(userId, uuid.parse(req.params.id)));
});
