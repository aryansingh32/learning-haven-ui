import { Router } from 'express';
import { z } from 'zod';
import { analyseAssignment, AnswerState, assessRisk } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser, Db } from '../db';
import { notFound } from '../errors';
import { hasPermission, requirePermission } from '../permissions';
import { analysisQuestions } from '../services/attempts';
import { courseProgress } from './courses';

// College analytics (slice C2b): item analysis per test, students at risk,
// one student's report, and college-wide trends. Everything is read as the
// staff member first (RLS proves what they may see); questions with answers
// and names are then read by the ids already proven.

export const analyticsRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // neutralise spreadsheet formulas
  return `"${safe.replace(/"/g, '""')}"`;
};
function sendCsv(res: import('express').Response, name: string, header: string[], rows: unknown[][]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^a-z0-9-]+/gi, '_').slice(0, 80)}.csv"`);
  res.send('﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'));
}

interface AttemptLite {
  id: string; user_id: string; assignment_id: string; status: string; score: string | null; total_marks: string;
  submitted_at: string | null; answers: AnswerState[]; question_order: { questionIds?: string[] } | null;
}
const pct = (t: Pick<AttemptLite, 'score' | 'total_marks'>) =>
  Number(t.total_marks) > 0 ? Math.round((1000 * Number(t.score)) / Number(t.total_marks)) / 10 : 0;

/** Each student's best submitted attempt. */
function bestAttempts(attempts: AttemptLite[]) {
  const best = new Map<string, AttemptLite>();
  for (const t of attempts) {
    if (t.status !== 'completed') continue;
    const b = best.get(t.user_id);
    if (!b || Number(t.score) > Number(b.score)) best.set(t.user_id, t);
  }
  return best;
}

async function names(userIds: string[], orgId: string) {
  if (userIds.length === 0) return new Map<string, { name: string | null; email: string; roll: string | null }>();
  return asSystem(async (db) => new Map((await db.query<{ id: string; full_name: string | null; email: string; roll_number: string | null }>(
    `select u.id, u.full_name, u.email, m.roll_number from public.users u
       left join campus.org_memberships m on m.user_id = u.id and m.org_id = $2
      where u.id = any($1::uuid[])`, [userIds, orgId])).rows.map((r) => [r.id, { name: r.full_name, email: r.email, roll: r.roll_number }])));
}

// ── Item analysis of one assignment ─────────────────────────────────────────
analyticsRouter.get('/assignments/:assignmentId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const assignmentId = uuid.parse(req.params.assignmentId);
  await requirePermission(userId, orgId, 'reports.view');
  const data = await asUser(userId, async (db) => {
    const a = (await db.query<{ id: string; title: string; test_id: string; batch_name: string }>(
      `select a.id, a.title, a.test_id, b.name as batch_name from campus.assignments a join campus.batches b on b.id = a.batch_id
        where a.id = $1 and a.org_id = $2`, [assignmentId, orgId])).rows[0];
    if (!a) return null;
    const attempts = (await db.query<AttemptLite>(
      `select id, user_id, assignment_id, status, score, total_marks, submitted_at, answers, question_order
         from public.test_attempts where assignment_id = $1`, [assignmentId])).rows;
    const assigned = (await db.query<{ n: number }>(`select count(*)::int as n from campus.assignment_students($1)`, [assignmentId])).rows[0].n;
    return { a, attempts, assigned };
  });
  if (!data) throw notFound('Assignment not found in this college.');

  const questions = await analysisQuestions(data.a.test_id);
  const best = [...bestAttempts(data.attempts).values()];
  const analysis = analyseAssignment(questions, best.map((t) => ({ userId: t.user_id, answers: t.answers ?? [], questionIds: t.question_order?.questionIds })));

  if (req.query.format === 'csv') {
    // Topic-wise marks per student: for remedial groups.
    await requirePermission(userId, orgId, 'reports.export');
    const people = await names(best.map((t) => t.user_id), orgId);
    const tags = analysis.tags.map((t) => t.tag);
    return sendCsv(res, `${data.a.title}-${data.a.batch_name}-topics`, ['Roll number', 'Name', 'Email', 'Score %', ...tags.map((t) => `${t} %`)],
      best.map((t) => {
        const p = people.get(t.user_id);
        return [p?.roll, p?.name, p?.email, pct(t), ...tags.map((tag) => analysis.studentTags[t.user_id]?.[tag] ?? '')];
      }).sort((x, y) => String(x[0] ?? '').localeCompare(String(y[0] ?? ''), undefined, { numeric: true })));
  }

  const scores = best.map(pct).sort((x, y) => x - y);
  const median = scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2] : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2) : null;
  res.json({
    assignment: { id: data.a.id, title: data.a.title, batch: data.a.batch_name },
    summary: {
      assigned: data.assigned, submitted: best.length,
      participation: data.assigned ? Math.round((100 * best.length) / data.assigned) : null,
      average: scores.length ? Math.round((10 * scores.reduce((s, x) => s + x, 0)) / scores.length) / 10 : null,
      median, highest: scores.at(-1) ?? null, lowest: scores[0] ?? null,
    },
    distribution: analysis.distribution,
    questions: analysis.questions.map((st) => {
      const q = questions.find((x) => x.id === st.questionId)!;
      return {
        ...st, number: q.number, type: q.question_type, body: q.body.slice(0, 300), section: q.section, marks: q.marks,
        tags: q.tags, options: q.options?.map((o) => ({ ...o, correct: (q.correct_options ?? []).includes(o.id) })) ?? null,
        // Plain-language reading of the numbers for faculty.
        flag: st.difficulty === null ? null
          : st.discrimination !== null && st.discrimination < 0 ? 'Weaker students did better than stronger ones — check the answer key.'
          : st.difficulty < 0.2 ? 'Very hard — most students got it wrong. Re-teach or review the wording.'
          : st.difficulty > 0.9 ? 'Very easy — almost everyone got it right.'
          : st.discrimination !== null && st.discrimination < 0.1 ? "Doesn't separate stronger from weaker students."
          : null,
      };
    }),
    tags: analysis.tags,
  });
});

// ── Students: progress, risk, and the placement export ──────────────────────
interface StudentRow {
  userId: string; rollNumber: string | null; name: string | null; email: string | null;
  departmentId: string | null; department: string | null; batches: string[];
  assigned: number; taken: number; missed: number; averagePercent: number | null; lastTestAt: string | null;
  overdueCourses: number; coursesCompleted: number; coursesAssigned: number; malpractice: boolean;
  risk: ReturnType<typeof assessRisk>;
  record?: { cgpa: number | null; backlogs: number | null; tenthPercent: number | null; twelfthPercent: number | null };
}

/** Every active student (optionally of one batch) with their numbers over the last `days`. */
export async function collegeStudents(userId: string, orgId: string, opts: { batchId?: string | null; days: number }) {
  const since = new Date(Date.now() - opts.days * 86_400_000);
  const base = await asUser(userId, async (db: Db) => {
    const records = await hasPermission(db, orgId, 'records.view');
    const members = (await db.query<{
      user_id: string; roll_number: string | null; department_id: string | null; department: string | null; batches: string[] | null;
      cgpa: string | null; active_backlogs: number | null; tenth_percent: string | null; twelfth_percent: string | null;
    }>(
      `select m.user_id, m.roll_number, m.department_id, d.name as department, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent,
              (select array_agg(b.name order by b.name) from campus.batch_members bm join campus.batches b on b.id = bm.batch_id
                where bm.org_id = m.org_id and bm.user_id = m.user_id) as batches
         from campus.org_memberships m left join campus.departments d on d.id = m.department_id
        where m.org_id = $1 and m.role = 'student' and m.status = 'active'
          and ($2::uuid is null or exists (select 1 from campus.batch_members bm where bm.batch_id = $2 and bm.user_id = m.user_id))`,
      [orgId, opts.batchId ?? null])).rows;
    // Closed, published tests in the window; who each was for.
    const assignments = (await db.query<{ id: string; closes_at: string; audience: string[] }>(
      `select a.id, a.closes_at, coalesce((select array_agg(s.user_id) from campus.assignment_students(a.id) s), '{}') as audience
         from campus.assignments a
        where a.org_id = $1 and a.status = 'published' and a.closes_at <= now() and a.closes_at >= $2
        order by a.closes_at`, [orgId, since])).rows;
    const attempts = assignments.length === 0 ? [] : (await db.query<AttemptLite & { malpractice: boolean }>(
      `select t.id, t.user_id, t.assignment_id, t.status, t.score, t.total_marks, t.submitted_at, '[]'::jsonb as answers, null as question_order,
              coalesce((select r.outcome = 'malpractice' from campus.incident_reviews r where r.attempt_id = t.id order by r.created_at desc limit 1), false) as malpractice
         from public.test_attempts t where t.assignment_id = any($1::uuid[])`, [assignments.map((a) => a.id)])).rows;
    const courses = (await db.query<{ id: string; batch_id: string; course_id: string; chapter_ids: string[] | null; due_at: string | null; audience: string[] }>(
      `select a.id, a.batch_id, a.course_id, a.chapter_ids, a.due_at,
              coalesce((select array_agg(s.user_id) from campus.course_assignment_students(a.id) s), '{}') as audience
         from campus.course_assignments a where a.org_id = $1 and a.status = 'published'`, [orgId])).rows;
    return { records, members, assignments, attempts, courses };
  });

  const courseStatus = new Map<string, Array<string>>(); // user → statuses
  for (const c of base.courses) {
    const p = await courseProgress(c, c.audience);
    for (const [u, st] of p.students) courseStatus.set(u, [...(courseStatus.get(u) ?? []), st.status]);
  }
  const people = await names(base.members.map((m) => m.user_id), orgId);
  const num = (v: string | number | null) => (v === null ? null : Number(v));

  return base.members.map((m): StudentRow => {
    const mine = base.assignments.filter((a) => a.audience.includes(m.user_id));
    const scores = mine.map((a) => {
      const best = base.attempts.filter((t) => t.assignment_id === a.id && t.user_id === m.user_id && t.status === 'completed')
        .sort((x, y) => Number(y.score) - Number(x.score))[0];
      return best ? pct(best) : null;
    });
    const statuses = courseStatus.get(m.user_id) ?? [];
    const malpractice = base.attempts.some((t) => t.user_id === m.user_id && t.malpractice);
    const risk = assessRisk({ scores, overdueCourses: statuses.filter((s) => s === 'overdue').length, malpractice });
    const last = base.attempts.filter((t) => t.user_id === m.user_id && t.submitted_at).map((t) => t.submitted_at!).sort().at(-1) ?? null;
    const p = people.get(m.user_id);
    return {
      userId: m.user_id, rollNumber: m.roll_number, name: p?.name ?? null, email: p?.email ?? null,
      departmentId: m.department_id, department: m.department, batches: m.batches ?? [],
      assigned: mine.length, taken: scores.filter((x) => x !== null).length, missed: risk.missed,
      averagePercent: risk.averagePercent, lastTestAt: last,
      overdueCourses: statuses.filter((s) => s === 'overdue').length,
      coursesCompleted: statuses.filter((s) => s === 'completed').length, coursesAssigned: statuses.length,
      malpractice, risk,
      ...(base.records ? { record: { cgpa: num(m.cgpa), backlogs: m.active_backlogs, tenthPercent: num(m.tenth_percent), twelfthPercent: num(m.twelfth_percent) } } : {}),
    };
  }).sort((a, b) => (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, { numeric: true }));
}

const studentsQuery = z.object({
  batchId: uuid.optional(),
  days: z.coerce.number().int().min(7).max(1095).default(180),
  format: z.enum(['csv']).optional(),
});

analyticsRouter.get('/students', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const q = studentsQuery.parse(req.query);
  await requirePermission(userId, orgId, 'reports.view');
  const rows = await collegeStudents(userId, orgId, { batchId: q.batchId, days: q.days });
  if (q.format === 'csv') {
    // The placement export: one line per student with marks, tests and (for record keepers) the academic record.
    await requirePermission(userId, orgId, 'reports.export');
    const withRecord = rows.some((r) => r.record);
    return sendCsv(res, 'students', [
      'Roll number', 'Name', 'Email', 'Department', 'Batches', ...(withRecord ? ['CGPA', 'Backlogs', '10th %', '12th %'] : []),
      'Tests assigned', 'Tests taken', 'Missed', 'Average %', 'Courses completed', 'Courses assigned', 'Overdue courses', 'Risk', 'Why',
    ], rows.map((r) => [
      r.rollNumber, r.name, r.email, r.department, r.batches.join('; '),
      ...(withRecord ? [r.record?.cgpa, r.record?.backlogs, r.record?.tenthPercent, r.record?.twelfthPercent] : []),
      r.assigned, r.taken, r.missed, r.averagePercent, r.coursesCompleted, r.coursesAssigned, r.overdueCourses, r.risk.level, r.risk.reasons.join('; '),
    ]));
  }
  res.json({
    days: q.days,
    summary: {
      students: rows.length,
      high: rows.filter((r) => r.risk.level === 'high').length,
      medium: rows.filter((r) => r.risk.level === 'medium').length,
      averagePercent: (() => { const s = rows.filter((r) => r.averagePercent !== null); return s.length ? Math.round(10 * s.reduce((n, r) => n + r.averagePercent!, 0) / s.length) / 10 : null; })(),
    },
    rows,
  });
});

/** One student's report: every test with score and rank, courses, topics, record. */
analyticsRouter.get('/students/:studentId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const studentId = uuid.parse(req.params.studentId);
  await requirePermission(userId, orgId, 'reports.view');
  const data = await asUser(userId, async (db) => {
    const member = (await db.query<{ roll_number: string | null; department: string | null }>(
      `select m.roll_number, d.name as department from campus.org_memberships m left join campus.departments d on d.id = m.department_id
        where m.org_id = $1 and m.user_id = $2 and m.role = 'student'`, [orgId, studentId])).rows[0];
    if (!member) return null;
    const tests = (await db.query<{ id: string; title: string; closes_at: string; test_id: string; status: string }>(
      `select a.id, a.title, a.closes_at, a.test_id, a.status from campus.assignments a
        where a.org_id = $1 and a.status = 'published' and exists (select 1 from campus.assignment_students(a.id) s where s.user_id = $2)
        order by a.closes_at desc limit 100`, [orgId, studentId])).rows;
    const attempts = tests.length === 0 ? [] : (await db.query<AttemptLite>(
      `select id, user_id, assignment_id, status, score, total_marks, submitted_at, answers, question_order
         from public.test_attempts where assignment_id = any($1::uuid[]) and status = 'completed'`, [tests.map((t) => t.id)])).rows;
    const courses = (await db.query<{ id: string; title: string; batch_id: string; course_id: string; chapter_ids: string[] | null; due_at: string | null }>(
      `select a.id, a.title, a.batch_id, a.course_id, a.chapter_ids, a.due_at from campus.course_assignments a
        where a.org_id = $1 and a.status = 'published' and exists (select 1 from campus.course_assignment_students(a.id) s where s.user_id = $2)`,
      [orgId, studentId])).rows;
    return { member, tests, attempts, courses, records: await hasPermission(db, orgId, 'records.view') };
  });
  if (!data) throw notFound('Student not found in this college.');

  // Topic strengths across all their tests.
  const topicTotals = new Map<string, { e: number; p: number }>();
  const history = [];
  for (const t of data.tests) {
    const all = data.attempts.filter((x) => x.assignment_id === t.id);
    const best = bestAttempts(all);
    const mine = best.get(studentId);
    const scores = [...best.values()].map(pct).sort((x, y) => y - x);
    const percent = mine ? pct(mine) : null;
    if (mine) {
      const qs = await analysisQuestions(t.test_id);
      const a = analyseAssignment(qs, [{ userId: studentId, answers: mine.answers ?? [], questionIds: mine.question_order?.questionIds }]);
      for (const tag of a.tags) {
        const agg = topicTotals.get(tag.tag) ?? { e: 0, p: 0 };
        agg.e += tag.earned; agg.p += tag.possible; topicTotals.set(tag.tag, agg);
      }
    }
    history.push({
      assignmentId: t.id, title: t.title, closesAt: t.closes_at, closed: new Date(t.closes_at) <= new Date(),
      score: mine ? Number(mine.score) : null, totalMarks: mine ? Number(mine.total_marks) : null, percent,
      rank: percent === null ? null : scores.indexOf(percent) + 1, of: scores.length,
      batchAverage: scores.length ? Math.round((10 * scores.reduce((s, x) => s + x, 0)) / scores.length) / 10 : null,
    });
  }
  const courseRows = [];
  for (const c of data.courses) {
    const p = await courseProgress(c, [studentId]);
    const st = p.students.get(studentId)!;
    courseRows.push({ id: c.id, title: c.title, dueAt: c.due_at, status: st.status, completedChapters: st.completedChapters, totalChapters: st.totalChapters, percent: st.percent });
  }
  const person = (await names([studentId], orgId)).get(studentId);
  const record = data.records ? await asSystem(async (db) => (await db.query(
    `select cgpa::float as cgpa, active_backlogs as backlogs, tenth_percent::float as "tenthPercent", twelfth_percent::float as "twelfthPercent"
       from campus.org_memberships where org_id = $1 and user_id = $2`, [orgId, studentId])).rows[0]) : undefined;
  const taken = history.filter((h) => h.percent !== null);
  res.json({
    student: { userId: studentId, name: person?.name ?? null, email: person?.email ?? null, rollNumber: data.member.roll_number, department: data.member.department },
    record,
    risk: assessRisk({
      scores: history.filter((h) => h.closed).reverse().map((h) => h.percent),
      overdueCourses: courseRows.filter((c) => c.status === 'overdue').length,
      malpractice: false,
    }),
    averagePercent: taken.length ? Math.round((10 * taken.reduce((s, h) => s + h.percent!, 0)) / taken.length) / 10 : null,
    tests: history,
    courses: courseRows,
    topics: [...topicTotals].map(([tag, v]) => ({ tag, percent: v.p ? Math.round((1000 * v.e) / v.p) / 10 : null, possible: v.p }))
      .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)),
  });
});

// ── College-wide trends and roll-ups ────────────────────────────────────────
analyticsRouter.get('/overview', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const months = z.coerce.number().int().min(1).max(24).default(6).parse(req.query.months);
  await requirePermission(userId, orgId, 'reports.view');
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0); since.setUTCMonth(since.getUTCMonth() - (months - 1));
  const data = await asUser(userId, async (db) => {
    const tests = (await db.query<{ id: string; closes_at: string; assigned: number }>(
      `select a.id, a.closes_at, (select count(*) from campus.assignment_students(a.id))::int as assigned
         from campus.assignments a where a.org_id = $1 and a.status = 'published' and a.closes_at >= $2 and a.closes_at <= now()`,
      [orgId, since])).rows;
    const attempts = tests.length === 0 ? [] : (await db.query<AttemptLite>(
      `select id, user_id, assignment_id, status, score, total_marks, submitted_at, '[]'::jsonb as answers, null as question_order
         from public.test_attempts where assignment_id = any($1::uuid[]) and status = 'completed'`, [tests.map((t) => t.id)])).rows;
    return { tests, attempts };
  });
  const series = Array.from({ length: months }, (_, i) => {
    const d = new Date(since); d.setUTCMonth(since.getUTCMonth() + i);
    return { month: d.toISOString().slice(0, 7), tests: 0, assigned: 0, submitted: 0, percents: [] as number[] };
  });
  for (const t of data.tests) {
    const m = series.find((x) => x.month === new Date(t.closes_at).toISOString().slice(0, 7));
    if (!m) continue;
    const best = bestAttempts(data.attempts.filter((a) => a.assignment_id === t.id));
    m.tests++; m.assigned += t.assigned; m.submitted += best.size; m.percents.push(...[...best.values()].map(pct));
  }
  const students = await collegeStudents(userId, orgId, { days: months * 31 });
  const rollup = (key: (s: StudentRow) => string[]) => {
    const groups = new Map<string, StudentRow[]>();
    for (const s of students) for (const k of key(s)) groups.set(k, [...(groups.get(k) ?? []), s]);
    return [...groups].map(([name, list]) => {
      const withAvg = list.filter((s) => s.averagePercent !== null);
      const assigned = list.reduce((n, s) => n + s.assigned, 0);
      return {
        name, students: list.length,
        averagePercent: withAvg.length ? Math.round((10 * withAvg.reduce((n, s) => n + s.averagePercent!, 0)) / withAvg.length) / 10 : null,
        participation: assigned ? Math.round((100 * list.reduce((n, s) => n + s.taken, 0)) / assigned) : null,
        atRisk: list.filter((s) => s.risk.level === 'high').length,
        coursesCompleted: list.reduce((n, s) => n + s.coursesCompleted, 0), coursesAssigned: list.reduce((n, s) => n + s.coursesAssigned, 0),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  };
  res.json({
    months: series.map(({ percents, ...m }) => ({
      ...m,
      participation: m.assigned ? Math.round((100 * m.submitted) / m.assigned) : null,
      averagePercent: percents.length ? Math.round((10 * percents.reduce((s, x) => s + x, 0)) / percents.length) / 10 : null,
    })),
    byBatch: rollup((s) => (s.batches.length ? s.batches : ['No batch'])),
    byDepartment: rollup((s) => [s.department ?? 'No department']),
  });
});
