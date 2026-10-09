import { Router } from 'express';
import { z } from 'zod';
import { normalizePolicy, PROCTORING_EVENTS } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { getAttemptView, recordEvent, resultsReleased, saveAnswer, startAttempt, submitAttempt } from '../services/attempts';

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
  const durations = new Map<string, number>(testIds.length === 0 ? [] : await asSystem(async (db) => {
    const { rows: tests } = await db.query<{ id: string; duration_seconds: number }>(
      `select id, duration_seconds from public.tests where id = any($1::uuid[])`, [testIds]
    );
    return tests.map((t) => [t.id, t.duration_seconds] as [string, number]);
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
      durationMinutes: Math.round((r.duration_seconds ?? durations.get(r.test_id) ?? 0) / 60),
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
  markedForReview: z.boolean().optional(),
});

studentRouter.put('/attempts/:id/answers/:questionId', async (req, res) => {
  const userId = userOf(req);
  res.json(await saveAnswer(userId, uuid.parse(req.params.id), uuid.parse(req.params.questionId), answerBody.parse(req.body)));
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
