import { Router } from 'express';
import { z } from 'zod';
import { normalizePolicy } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { badRequest, HttpError, notFound } from '../errors';
import { requirePermission } from '../permissions';
import { gradeCodingAnswers } from '../services/attempts';
import { judgeAvailable } from '../services/judge';

export const assignmentsRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

assignmentsRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'assessments.create');
  res.json(await asUser(userId, async (db) => (await db.query(
    `select a.id, a.title, a.status, a.opens_at as "opensAt", a.closes_at as "closesAt", a.max_attempts as "maxAttempts",
            a.result_release as "resultRelease", a.results_released_at as "resultsReleasedAt",
            a.batch_id as "batchId", b.name as "batchName", a.test_id as "testId", t.title as "testTitle",
            (select count(*) from campus.batch_members bm where bm.batch_id = a.batch_id)::int as "assigned",
            (select count(distinct x.user_id) from public.test_attempts x where x.assignment_id = a.id)::int as "started",
            (select count(distinct x.user_id) from public.test_attempts x
               where x.assignment_id = a.id and x.status = 'completed')::int as "submitted"
       from campus.assignments a
       join campus.batches b on b.id = a.batch_id
       left join public.tests t on t.id = a.test_id
      where a.org_id = $1 and a.status <> 'archived'
      order by a.opens_at desc`,
    [orgId]
  )).rows));
});

const proctoringBody = z.object({
  enabled: z.boolean(),
  requireFullscreen: z.boolean(),
  blockClipboard: z.boolean(),
  warnFirst: z.boolean(),
  maxViolations: z.number().int().min(1).max(50).nullable(),
}).partial();

const assignmentBody = z.object({
  batchId: uuid,
  testId: uuid,
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().max(5000).nullable().optional(),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  maxAttempts: z.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  resultRelease: z.enum(['immediately', 'after_close', 'manual']).default('after_close'),
  proctoring: proctoringBody.optional(),
  publish: z.boolean().default(false),
}).refine((a) => a.closesAt > a.opensAt, { path: ['closesAt'], message: 'The test must close after it opens.' });

assignmentsRouter.post('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const a = assignmentBody.parse(req.body);
  await requirePermission(userId, orgId, 'assessments.create');
  const created = await asUser(userId, async (db) => (await db.query(
    `insert into campus.assignments
       (org_id, batch_id, test_id, title, instructions, opens_at, closes_at, duration_seconds, max_attempts,
        shuffle_questions, shuffle_options, result_release, proctoring, status, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
     returning id, title, status`,
    [orgId, a.batchId, a.testId, a.title, a.instructions ?? null, a.opensAt, a.closesAt,
     a.durationMinutes ? a.durationMinutes * 60 : null, a.maxAttempts, a.shuffleQuestions, a.shuffleOptions,
     a.resultRelease, JSON.stringify(normalizePolicy(a.proctoring)), a.publish ? 'published' : 'draft', userId]
  )).rows[0]);
  res.status(201).json(created);
});

const assignmentPatch = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  releaseResults: z.literal(true).optional(),
});

assignmentsRouter.patch('/:assignmentId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = assignmentPatch.parse(req.body);
  await requirePermission(userId, orgId, 'assessments.create');
  const updated = await asUser(userId, async (db) => (await db.query(
    `update campus.assignments set
        status = coalesce($3, status),
        opens_at = coalesce($4, opens_at),
        closes_at = coalesce($5, closes_at),
        results_released_at = case when $6::boolean then coalesce(results_released_at, now()) else results_released_at end
      where id = $1 and org_id = $2
      returning id, status, opens_at as "opensAt", closes_at as "closesAt", results_released_at as "resultsReleasedAt"`,
    [uuid.parse(req.params.assignmentId), orgId, body.status ?? null, body.opensAt ?? null, body.closesAt ?? null,
     body.releaseResults === true]
  )).rows[0]);
  if (!updated) throw notFound('Assignment not found in this college.');
  res.json(updated);
});

const SUBMIT_REASON: Record<string, string> = {
  manual: 'Submitted', timeout: 'Time ran out', violations: 'Auto-submitted (violations)', closed: 'Closed',
};

/**
 * One row per student in the batch — including those who never started —
 * so averages and completion rates reflect everyone who was assigned.
 */
assignmentsRouter.get('/:assignmentId/results', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const assignmentId = uuid.parse(req.params.assignmentId);
  await requirePermission(userId, orgId, 'reports.view');

  const data = await asUser(userId, async (db) => {
    const assignment = (await db.query(
      `select a.id, a.title, a.batch_id, a.closes_at, b.name as batch_name
         from campus.assignments a join campus.batches b on b.id = a.batch_id
        where a.id = $1 and a.org_id = $2`, [assignmentId, orgId])).rows[0];
    if (!assignment) return null;
    const members = (await db.query<{ user_id: string; roll_number: string | null }>(
      `select bm.user_id, m.roll_number from campus.batch_members bm
         join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
        where bm.batch_id = $1 and m.role = 'student'`, [assignment.batch_id])).rows;
    const attempts = (await db.query<{
      user_id: string; status: string; score: string | null; total_marks: string; submitted_at: string | null;
      violation_count: number; submit_reason: string | null; attempt_number: number; grading_pending: boolean;
    }>(
      `select user_id, status, score, total_marks, submitted_at, violation_count, submit_reason, attempt_number,
              exists (select 1 from jsonb_array_elements(answers) a where a->>'grading' = 'pending') as grading_pending
         from public.test_attempts where assignment_id = $1`, [assignmentId])).rows;
    return { assignment, members, attempts };
  });
  if (!data) throw notFound('Assignment not found in this college.');

  const names = await asSystem(async (db) => new Map((await db.query<{ id: string; full_name: string | null; email: string }>(
    `select id, full_name, email from public.users where id = any($1::uuid[])`,
    [data.members.map((m) => m.user_id)]
  )).rows.map((r) => [r.id, r])));

  const rows = data.members.map((m) => {
    const mine = data.attempts.filter((a) => a.user_id === m.user_id);
    const done = mine.filter((a) => a.status === 'completed');
    const best = done.sort((x, y) => Number(y.score) - Number(x.score))[0];
    const totalMarks = Number(best?.total_marks ?? mine[0]?.total_marks ?? 0);
    const score = best ? Number(best.score) : null;
    return {
      userId: m.user_id,
      rollNumber: m.roll_number,
      name: names.get(m.user_id)?.full_name ?? null,
      email: names.get(m.user_id)?.email ?? null,
      status: best ? 'submitted' : mine.length ? 'in_progress' : 'not_attempted',
      score,
      totalMarks: totalMarks || null,
      percent: score !== null && totalMarks > 0 ? Math.round((score / totalMarks) * 1000) / 10 : null,
      attempts: mine.length,
      violations: mine.reduce((sum, a) => sum + a.violation_count, 0),
      submitReason: best?.submit_reason ?? null,
      submittedAt: best?.submitted_at ?? null,
      // Coding answers not judged yet (judge was down at submit) — see /regrade.
      gradingPending: done.some((a) => a.grading_pending),
    };
  }).sort((a, b) => (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, { numeric: true }));

  const scored = rows.filter((r) => r.percent !== null).map((r) => r.percent!);
  const summary = {
    assigned: rows.length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    notAttempted: rows.filter((r) => r.status === 'not_attempted').length,
    averagePercent: scored.length ? Math.round((scored.reduce((s, p) => s + p, 0) / scored.length) * 10) / 10 : null,
    highestPercent: scored.length ? Math.max(...scored) : null,
    lowestPercent: scored.length ? Math.min(...scored) : null,
    flagged: rows.filter((r) => r.violations > 0).length,
    gradingPending: rows.filter((r) => r.gradingPending).length,
  };

  if (req.query.format === 'csv') {
    await requirePermission(userId, orgId, 'reports.export');
    const header = ['Roll number', 'Name', 'Email', 'Status', 'Score', 'Out of', 'Percent', 'Attempts', 'Violations', 'How it ended', 'Submitted at'];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      // Neutralise spreadsheet formulas and quote everything.
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = [header, ...rows.map((r) => [
      r.rollNumber, r.name, r.email,
      r.status === 'submitted' ? 'Submitted' : r.status === 'in_progress' ? 'In progress' : 'Not attempted',
      r.score, r.totalMarks, r.percent, r.attempts, r.violations,
      r.submitReason ? SUBMIT_REASON[r.submitReason] : '', r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
    ])].map((cols) => cols.map(esc).join(','));
    const filename = `${data.assignment.title}-${data.assignment.batch_name}`.replace(/[^a-z0-9-]+/gi, '_').slice(0, 80);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send('﻿' + lines.join('\r\n'));
  }

  res.json({ assignment: { id: data.assignment.id, title: data.assignment.title, batch: data.assignment.batch_name }, summary, rows });
});

const regradeBody = z.object({ rejudge: z.boolean().default(false) });

/**
 * Judge coding answers of submitted attempts again: by default only those
 * still pending (judge was down at submit); `rejudge` re-runs every coding
 * answer, e.g. after fixing a question's test cases.
 */
assignmentsRouter.post('/:assignmentId/regrade', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const assignmentId = uuid.parse(req.params.assignmentId);
  const { rejudge } = regradeBody.parse(req.body ?? {});
  await requirePermission(userId, orgId, 'assessments.grade');
  await requirePermission(userId, orgId, 'reports.view'); // to read the attempts
  if (!judgeAvailable()) throw new HttpError(503, 'The code judge is not configured yet, so coding answers cannot be graded.');

  // RLS proves this college's staff may see these attempts.
  const attemptIds = await asUser(userId, async (db) => (await db.query<{ id: string }>(
    `select t.id from public.test_attempts t join campus.assignments a on a.id = t.assignment_id
      where t.assignment_id = $1 and a.org_id = $2 and t.status = 'completed'
        and ($3 or exists (select 1 from jsonb_array_elements(t.answers) x where x->>'grading' = 'pending'))`,
    [assignmentId, orgId, rejudge]
  )).rows.map((r) => r.id));

  let judged = 0;
  let pending = 0;
  for (const id of attemptIds) {
    const r = await gradeCodingAnswers(id, rejudge);
    judged += r.judged;
    pending += r.pending;
  }
  res.json({ attempts: attemptIds.length, judged, pending });
});

assignmentsRouter.get('/:assignmentId/attempts/:attemptId/events', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'reports.view');
  const events = await asUser(userId, async (db) => (await db.query(
    `select e.event_type as type, e.severity, e.occurred_at as "occurredAt"
       from campus.proctoring_events e join public.test_attempts a on a.id = e.attempt_id
      where e.attempt_id = $1 and a.assignment_id = $2 and e.org_id = $3 order by e.occurred_at`,
    [uuid.parse(req.params.attemptId), uuid.parse(req.params.assignmentId), orgId]
  )).rows);
  if (events.length === 0) {
    const exists = await asUser(userId, async (db) => (await db.query(
      `select 1 from public.test_attempts where id = $1 and assignment_id = $2`,
      [uuid.parse(req.params.attemptId), uuid.parse(req.params.assignmentId)])).rowCount);
    if (!exists) throw badRequest('That attempt is not part of this assignment.');
  }
  res.json(events);
});
