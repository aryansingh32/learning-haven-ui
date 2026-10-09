import { Router } from 'express';
import { z } from 'zod';
import { normalizePolicy } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { badRequest, HttpError, notFound } from '../errors';
import { requireAnyPermission, requirePermission } from '../permissions';
import { attemptProgress, AttemptRow, extendAttempt, forceSubmitAttempt, gradeCodingAnswers } from '../services/attempts';
import { judgeAvailable } from '../services/judge';

export const assignmentsRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

assignmentsRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  // Authors, invigilators and report viewers all need the list; RLS decides the rows.
  await requireAnyPermission(userId, orgId, ['assessments.create', 'assessments.invigilate', 'reports.view']);
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
  invigilator: 'Ended by invigilator',
};
const REVIEW_OUTCOME: Record<string, string> = { no_issue: 'No issue', warning: 'Warning', malpractice: 'Malpractice' };

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
      review_outcome: string | null;
    }>(
      `select t.user_id, t.status, t.score, t.total_marks, t.submitted_at, t.violation_count, t.submit_reason, t.attempt_number,
              exists (select 1 from jsonb_array_elements(t.answers) a where a->>'grading' = 'pending') as grading_pending,
              (select r.outcome from campus.incident_reviews r where r.attempt_id = t.id order by r.created_at desc limit 1) as review_outcome
         from public.test_attempts t where t.assignment_id = $1`, [assignmentId])).rows;
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
      // The invigilator's latest decision on the attempt that counts (or the open one).
      review: (best ?? mine[0])?.review_outcome ?? null,
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
    const header = ['Roll number', 'Name', 'Email', 'Status', 'Score', 'Out of', 'Percent', 'Attempts', 'Violations', 'Review', 'How it ended', 'Submitted at'];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      // Neutralise spreadsheet formulas and quote everything.
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = [header, ...rows.map((r) => [
      r.rollNumber, r.name, r.email,
      r.status === 'submitted' ? 'Submitted' : r.status === 'in_progress' ? 'In progress' : 'Not attempted',
      r.score, r.totalMarks, r.percent, r.attempts, r.violations, r.review ? REVIEW_OUTCOME[r.review] : '',
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

// ── Live invigilation ────────────────────────────────────────────────────────
const OFFLINE_AFTER_MS = 60_000;
const WATCHERS = ['assessments.invigilate', 'reports.view'] as const;

/** Prove the caller may see this assignment (RLS), returning its basics. */
async function visibleToStaff(userId: string, orgId: string, assignmentId: string) {
  const a = await asUser(userId, async (db) => (await db.query<{ id: string; title: string; batch_id: string; opens_at: string; closes_at: string }>(
    `select id, title, batch_id, opens_at, closes_at from campus.assignments where id = $1 and org_id = $2`, [assignmentId, orgId])).rows[0]);
  if (!a) throw notFound('Assignment not found in this college.');
  return a;
}

/** Prove the caller may see this attempt of this assignment (RLS). */
async function visibleAttempt(userId: string, orgId: string, assignmentId: string, attemptId: string) {
  const row = await asUser(userId, async (db) => (await db.query<{ id: string; org_id: string; user_id: string }>(
    `select id, org_id, user_id from public.test_attempts where id = $1 and assignment_id = $2 and org_id = $3`,
    [attemptId, assignmentId, orgId])).rows[0]);
  if (!row) throw notFound('That attempt is not part of this assignment.');
  return row;
}

/** Everyone in the batch with their attempt's live state. Poll every few seconds. */
assignmentsRouter.get('/:assignmentId/live', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const assignmentId = uuid.parse(req.params.assignmentId);
  await requireAnyPermission(userId, orgId, [...WATCHERS]);
  const assignment = await visibleToStaff(userId, orgId, assignmentId);

  // Access is proven above; the rest is read by explicit ids.
  const data = await asSystem(async (db) => {
    const batch = (await db.query<{ name: string }>(`select name from campus.batches where id = $1`, [assignment.batch_id])).rows[0];
    const members = (await db.query<{ user_id: string; roll_number: string | null; full_name: string | null; email: string }>(
      `select bm.user_id, m.roll_number, u.full_name, u.email
         from campus.batch_members bm
         join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
         join public.users u on u.id = bm.user_id
        where bm.batch_id = $1 and m.role = 'student'`, [assignment.batch_id])).rows;
    const attempts = (await db.query<AttemptRow>(
      `select * from public.test_attempts where assignment_id = $1 order by attempt_number desc`, [assignmentId])).rows;
    const ids = attempts.map((a) => a.id);
    const events = new Map((ids.length === 0 ? [] : (await db.query<{ attempt_id: string; violations: number; last_type: string; last_severity: string; last_at: string }>(
      `select attempt_id,
              count(*) filter (where severity = 'violation')::int as violations,
              (array_agg(event_type order by occurred_at desc))[1] as last_type,
              (array_agg(severity order by occurred_at desc))[1] as last_severity,
              max(occurred_at) as last_at
         from campus.proctoring_events where attempt_id = any($1::uuid[]) group by attempt_id`, [ids])).rows).map((e) => [e.attempt_id, e]));
    const reviews = new Map((ids.length === 0 ? [] : (await db.query<{ attempt_id: string; outcome: string; created_at: string }>(
      `select distinct on (attempt_id) attempt_id, outcome, created_at from campus.incident_reviews
        where attempt_id = any($1::uuid[]) order by attempt_id, created_at desc`, [ids])).rows).map((r) => [r.attempt_id, r]));
    const extra = new Map((ids.length === 0 ? [] : (await db.query<{ attempt_id: string; minutes: number }>(
      `select attempt_id, sum(minutes)::int as minutes from campus.attempt_adjustments
        where attempt_id = any($1::uuid[]) and kind = 'extend' group by attempt_id`, [ids])).rows).map((r) => [r.attempt_id, r.minutes]));
    return { batch, members, attempts, events, reviews, extra };
  });

  const now = Date.now();
  const rows = data.members.map((m) => {
    const mine = data.attempts.filter((a) => a.user_id === m.user_id);
    const a = mine.find((x) => x.status === 'in_progress') ?? mine[0];
    const ev = a ? data.events.get(a.id) : undefined;
    const review = a ? data.reviews.get(a.id) : undefined;
    const lastSeen = a?.last_seen_at ?? a?.started_at ?? null;
    const status = !a ? 'not_started' : a.status === 'completed' ? 'submitted'
      : lastSeen && now - new Date(lastSeen).getTime() > OFFLINE_AFTER_MS ? 'offline' : 'active';
    return {
      userId: m.user_id,
      name: m.full_name,
      email: m.email,
      rollNumber: m.roll_number,
      status,
      attemptId: a?.id ?? null,
      startedAt: a?.started_at ?? null,
      expiresAt: a?.expires_at ?? null,
      submittedAt: a?.submitted_at ?? null,
      submitReason: a?.submit_reason ?? null,
      lastSeenAt: lastSeen,
      ...(a ? attemptProgress(a) : { answered: 0, total: 0, section: null }),
      violations: ev?.violations ?? 0,
      lastEvent: ev ? { type: ev.last_type, severity: ev.last_severity, at: ev.last_at } : null,
      review: review ? { outcome: review.outcome, at: review.created_at } : null,
      extraMinutes: a ? data.extra.get(a.id) ?? 0 : 0,
    };
  }).sort((x, y) => (x.rollNumber ?? '').localeCompare(y.rollNumber ?? '', undefined, { numeric: true }));

  res.json({
    assignment: { id: assignment.id, title: assignment.title, batch: data.batch?.name ?? '', opensAt: assignment.opens_at, closesAt: assignment.closes_at },
    serverNow: new Date(now).toISOString(),
    summary: {
      assigned: rows.length,
      notStarted: rows.filter((r) => r.status === 'not_started').length,
      active: rows.filter((r) => r.status === 'active').length,
      offline: rows.filter((r) => r.status === 'offline').length,
      submitted: rows.filter((r) => r.status === 'submitted').length,
      // Flagged and nobody has looked yet.
      needsReview: rows.filter((r) => r.violations > 0 && !r.review).length,
    },
    rows,
  });
});

const adjustBody = z.object({ minutes: z.number().int().min(1).max(240), reason: z.string().trim().min(3).max(500) });

assignmentsRouter.post('/:assignmentId/attempts/:attemptId/extend', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = adjustBody.parse(req.body);
  await requirePermission(userId, orgId, 'assessments.invigilate');
  const attempt = await visibleAttempt(userId, orgId, uuid.parse(req.params.assignmentId), uuid.parse(req.params.attemptId));
  const updated = await extendAttempt(attempt.id, body.minutes);
  await asSystem((db) => db.query(
    `insert into campus.attempt_adjustments (org_id, attempt_id, kind, minutes, reason, actor_id) values ($1, $2, 'extend', $3, $4, $5)`,
    [orgId, attempt.id, body.minutes, body.reason, userId]));
  res.json({ expiresAt: updated.expires_at });
});

assignmentsRouter.post('/:assignmentId/attempts/:attemptId/force-submit', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const { reason } = adjustBody.pick({ reason: true }).parse(req.body);
  await requirePermission(userId, orgId, 'assessments.invigilate');
  const attempt = await visibleAttempt(userId, orgId, uuid.parse(req.params.assignmentId), uuid.parse(req.params.attemptId));
  // Record the decision first, so the timeline reads "ended by invigilator → submitted".
  const open = await asSystem(async (db) => (await db.query(
    `select 1 from public.test_attempts where id = $1 and status = 'in_progress'`, [attempt.id])).rowCount);
  if (!open) throw new HttpError(409, 'This attempt has already ended.');
  await asSystem((db) => db.query(
    `insert into campus.attempt_adjustments (org_id, attempt_id, kind, reason, actor_id) values ($1, $2, 'force_submit', $3, $4)`,
    [orgId, attempt.id, reason, userId]));
  await forceSubmitAttempt(attempt.id);
  res.json({ ok: true });
});

const reviewBody = z.object({
  outcome: z.enum(['no_issue', 'warning', 'malpractice']),
  note: z.string().trim().max(2000).nullable().optional(),
});

assignmentsRouter.post('/:assignmentId/attempts/:attemptId/reviews', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = reviewBody.parse(req.body);
  await requirePermission(userId, orgId, 'assessments.invigilate');
  const attempt = await visibleAttempt(userId, orgId, uuid.parse(req.params.assignmentId), uuid.parse(req.params.attemptId));
  // RLS checks the reviewer signs as themselves, for an attempt of their college.
  const created = await asUser(userId, async (db) => (await db.query(
    `insert into campus.incident_reviews (org_id, attempt_id, reviewer_id, outcome, note) values ($1, $2, $3, $4, $5)
     returning id, outcome, note, created_at as "createdAt"`,
    [attempt.org_id, attempt.id, userId, body.outcome, body.note || null])).rows[0]);
  res.status(201).json(created);
});

/** Everything that happened in one attempt, in order: start, proctoring events, staff actions, submit. */
assignmentsRouter.get('/:assignmentId/attempts/:attemptId/timeline', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requireAnyPermission(userId, orgId, [...WATCHERS]);
  const attempt = await visibleAttempt(userId, orgId, uuid.parse(req.params.assignmentId), uuid.parse(req.params.attemptId));
  const data = await asUser(userId, async (db) => ({
    attempt: (await db.query<{ started_at: string; submitted_at: string | null; submit_reason: string | null }>(
      `select started_at, submitted_at, submit_reason from public.test_attempts where id = $1`, [attempt.id])).rows[0],
    events: (await db.query<{ type: string; severity: string; at: string }>(
      `select event_type as type, severity, occurred_at as at from campus.proctoring_events where attempt_id = $1`, [attempt.id])).rows,
    adjustments: (await db.query<{ kind: string; minutes: number | null; reason: string; actor_id: string | null; at: string }>(
      `select kind, minutes, reason, actor_id, created_at as at from campus.attempt_adjustments where attempt_id = $1`, [attempt.id])).rows,
    reviews: (await db.query<{ outcome: string; note: string | null; reviewer_id: string | null; at: string }>(
      `select outcome, note, reviewer_id, created_at as at from campus.incident_reviews where attempt_id = $1`, [attempt.id])).rows,
  }));
  const staffIds = [...new Set([...data.adjustments.map((x) => x.actor_id), ...data.reviews.map((x) => x.reviewer_id)].filter(Boolean))] as string[];
  const names = new Map(staffIds.length === 0 ? [] : await asSystem(async (db) => (await db.query<{ id: string; name: string }>(
    `select id, coalesce(full_name, email) as name from public.users where id = any($1::uuid[])`, [staffIds])).rows.map((r) => [r.id, r.name] as [string, string])));
  const items = [
    { at: data.attempt.started_at, kind: 'started' as const },
    ...data.events.map((e) => ({ at: e.at, kind: 'event' as const, type: e.type, severity: e.severity })),
    ...data.adjustments.map((x) => ({ at: x.at, kind: x.kind as 'extend' | 'force_submit', minutes: x.minutes, reason: x.reason, by: x.actor_id ? names.get(x.actor_id) ?? null : null })),
    ...data.reviews.map((r) => ({ at: r.at, kind: 'review' as const, outcome: r.outcome, note: r.note, by: r.reviewer_id ? names.get(r.reviewer_id) ?? null : null })),
    ...(data.attempt.submitted_at ? [{ at: data.attempt.submitted_at, kind: 'submitted' as const, reason: data.attempt.submit_reason }] : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  res.json({ items });
});
