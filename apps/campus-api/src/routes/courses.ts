import { Router } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser, Db } from '../db';
import { badRequest, notFound } from '../errors';
import { requireAnyPermission, requirePermission } from '../permissions';
import { logExport } from '../services/audit';
import { notifyCourseAssigned } from '../services/notify';

// Courses for colleges (slice D6). Forge's Learn courses and a college's own
// courses can be given to a batch, whole or a few chapters, with a due date.
// Students study them in the learner app as usual; staff see each student's
// chapter progress here.
//
// Courses and chapter progress have no RLS policies for staff (progress is
// readable only by its owner), so after asUser proves the college may see a
// course or an assignment, those rows are read with asSystem by explicit ids.

export const FORGE_ORG_ID = '00000000-0000-0000-0000-00000000f0f0';
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

type CourseRow = {
  id: string; title: string; slug: string; description: string | null; difficulty_level: string | null;
  cover_image: string | null; is_premium: boolean; owner_org_id: string; chapters: number; minutes: number; licensed: boolean;
};

/** Courses this college may assign: its own published ones and Forge's public ones. */
async function collegeCourses(db: Db, orgId: string, courseId?: string): Promise<CourseRow[]> {
  return (await db.query<CourseRow>(
    `select c.id, c.title, c.slug, c.description, c.difficulty_level, c.cover_image, coalesce(c.is_premium, false) as is_premium,
            c.owner_org_id,
            (select count(*) from public.chapters ch where ch.course_id = c.id and coalesce(ch.is_active, true))::int as chapters,
            (select coalesce(sum(ch.est_minutes), 0) from public.chapters ch where ch.course_id = c.id and coalesce(ch.is_active, true))::int as minutes,
            (c.owner_org_id = $1 or not coalesce(c.is_premium, false) or campus.course_licensed($1, c.id)) as licensed
       from public.courses c
      where c.deleted_at is null and c.is_published
        and (c.owner_org_id = $1 or (c.owner_org_id = $2 and c.visibility = 'public'))
        and ($3::uuid is null or c.id = $3)
      order by (c.owner_org_id = $1) desc, c.order_index nulls last, c.title`,
    [orgId, FORGE_ORG_ID, courseId ?? null]
  )).rows;
}

const courseJson = (c: CourseRow) => ({
  id: c.id, title: c.title, slug: c.slug, description: c.description, difficulty: c.difficulty_level,
  coverImage: c.cover_image, isPremium: c.is_premium, owner: c.owner_org_id === FORGE_ORG_ID ? 'forge' : 'college',
  chapters: c.chapters, minutes: c.minutes, licensed: c.licensed,
});

type ChapterRow = { id: string; chapter_number: number; title: string; est_minutes: number | null };

async function chaptersOf(db: Db, courseId: string): Promise<ChapterRow[]> {
  return (await db.query<ChapterRow>(
    `select id, chapter_number, title, est_minutes from public.chapters
      where course_id = $1 and coalesce(is_active, true) order by chapter_number, created_at`, [courseId])).rows;
}

// ── College catalogue ───────────────────────────────────────────────────────
export const orgCoursesRouter = Router({ mergeParams: true });

orgCoursesRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requireAnyPermission(userId, orgId, ['assessments.create', 'reports.view']);
  res.json((await asSystem((db) => collegeCourses(db, orgId))).map(courseJson));
});

orgCoursesRouter.get('/:courseId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const courseId = uuid.parse(req.params.courseId);
  await requireAnyPermission(userId, orgId, ['assessments.create', 'reports.view']);
  const data = await asSystem(async (db) => {
    const [course] = await collegeCourses(db, orgId, courseId);
    return course ? { course, chapters: await chaptersOf(db, courseId) } : null;
  });
  if (!data) throw notFound('Course not found.');
  res.json({
    ...courseJson(data.course),
    chapterList: data.chapters.map((c) => ({ id: c.id, number: c.chapter_number, title: c.title, minutes: c.est_minutes })),
  });
});

// ── Progress ────────────────────────────────────────────────────────────────
type AssignmentRow = {
  id: string; batch_id: string; course_id: string; chapter_ids: string[] | null; due_at: string | null;
};

export type StudentCourseStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

/** Each student's progress on the assigned chapters. Call only after access to the assignment is proven. */
export async function courseProgress(assignment: AssignmentRow, userIds: string[]) {
  return asSystem(async (db) => {
    const all = await chaptersOf(db, assignment.course_id);
    const wanted = assignment.chapter_ids ? new Set(assignment.chapter_ids) : null;
    const chapters = wanted ? all.filter((c) => wanted.has(c.id)) : all;
    const rows = userIds.length === 0 || chapters.length === 0 ? [] : (await db.query<{
      user_id: string; chapter_id: string; status: string; steps: number; completed_at: string | null; updated_at: string | null;
    }>(
      `select user_id, chapter_id, status, coalesce(cardinality(steps_completed), 0) as steps, completed_at, updated_at
         from public.user_chapter_progress where user_id = any($1::uuid[]) and chapter_id = any($2::uuid[])`,
      [userIds, chapters.map((c) => c.id)]
    )).rows;
    const overdue = assignment.due_at !== null && new Date(assignment.due_at) < new Date();
    const byUser = new Map(userIds.map((id) => [id, {
      completed: 0, started: false, lastActivity: null as string | null, completedAt: null as string | null,
      done: new Set<string>(),
    }]));
    for (const r of rows) {
      const u = byUser.get(r.user_id);
      if (!u) continue;
      if (r.status === 'COMPLETED') {
        u.completed += 1;
        u.done.add(r.chapter_id);
        if (r.completed_at && (!u.completedAt || r.completed_at > u.completedAt)) u.completedAt = r.completed_at;
      }
      if (r.status === 'COMPLETED' || r.status === 'IN_PROGRESS' || r.steps > 0) u.started = true;
      const seen = r.completed_at ?? r.updated_at;
      if (seen && (!u.lastActivity || seen > u.lastActivity)) u.lastActivity = seen;
    }
    const total = chapters.length;
    const students = new Map([...byUser].map(([id, u]) => {
      const status: StudentCourseStatus = total > 0 && u.completed >= total ? 'completed'
        : overdue ? 'overdue' : u.started ? 'in_progress' : 'not_started';
      return [id, {
        status, completedChapters: u.completed, totalChapters: total,
        percent: total ? Math.round((u.completed / total) * 100) : 0,
        lastActivity: u.lastActivity, completedAt: status === 'completed' ? u.completedAt : null,
        chapters: chapters.map((c) => u.done.has(c.id)),
      }];
    }));
    return { chapters, students };
  });
}

// ── Course assignments (staff) ──────────────────────────────────────────────
export const courseAssignmentsRouter = Router({ mergeParams: true });

const STATUS_LABEL: Record<StudentCourseStatus, string> = {
  not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', overdue: 'Overdue',
};

courseAssignmentsRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requireAnyPermission(userId, orgId, ['assessments.create', 'reports.view']);
  const list = await asUser(userId, async (db) => (await db.query<AssignmentRow & {
    title: string; status: string; created_at: string; batch_name: string; section_name: string | null; members: string[];
  }>(
    `select a.id, a.batch_id, a.course_id, a.chapter_ids, a.due_at, a.title, a.status, a.created_at, b.name as batch_name,
            (select s.name from campus.sections s where s.id = a.section_id) as section_name,
            coalesce((select array_agg(s.user_id) from campus.course_assignment_students(a.id) s), '{}') as members
       from campus.course_assignments a join campus.batches b on b.id = a.batch_id
      where a.org_id = $1 and a.status <> 'archived'
      order by a.created_at desc`, [orgId])).rows);

  const titles = new Map(list.length === 0 ? [] : await asSystem(async (db) => (await db.query<{ id: string; title: string }>(
    `select id, title from public.courses where id = any($1::uuid[])`, [[...new Set(list.map((a) => a.course_id))]]
  )).rows.map((r) => [r.id, r.title] as [string, string])));

  const out = [];
  for (const a of list) {
    const p = await courseProgress(a, a.members);
    const statuses = [...p.students.values()].map((s) => s.status);
    out.push({
      id: a.id, title: a.title, status: a.status, dueAt: a.due_at, createdAt: a.created_at,
      batchId: a.batch_id, batchName: a.batch_name, sectionName: a.section_name, courseId: a.course_id, courseTitle: titles.get(a.course_id) ?? null,
      chapters: p.chapters.length, wholeCourse: a.chapter_ids === null,
      assigned: a.members.length,
      completed: statuses.filter((s) => s === 'completed').length,
      inProgress: statuses.filter((s) => s === 'in_progress').length,
      overdue: statuses.filter((s) => s === 'overdue').length,
    });
  }
  res.json(out);
});

const createBody = z.object({
  batchId: uuid,
  sectionId: uuid.nullable().optional(),
  courseId: uuid,
  chapterIds: z.array(uuid).min(1).max(500).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  publish: z.boolean().default(false),
});

courseAssignmentsRouter.post('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = createBody.parse(req.body);
  await requirePermission(userId, orgId, 'assessments.create');
  if (body.dueAt && body.dueAt < new Date()) throw badRequest('The due date is in the past.');
  const [course] = await asSystem((db) => collegeCourses(db, orgId, body.courseId));
  if (!course) throw notFound('Course not found.');
  if (!course.licensed) throw badRequest('This is a premium course: your college needs a Forge licence for it.');
  const chapterIds = body.chapterIds ? [...new Set(body.chapterIds)] : null;
  // The trigger re-checks the course, the licence and the chapters.
  const created = await asUser(userId, async (db) => (await db.query(
    `insert into campus.course_assignments (org_id, batch_id, course_id, chapter_ids, title, instructions, due_at, status, created_by, section_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, title, status, due_at as "dueAt"`,
    [orgId, body.batchId, body.courseId, chapterIds, body.title ?? course.title, body.instructions ?? null,
     body.dueAt ?? null, body.publish ? 'published' : 'draft', userId, body.sectionId ?? null]
  )).rows[0]);
  if (created.status === 'published') await notifyCourseAssigned(created.id);
  res.status(201).json(created);
});

const patchBody = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  chapterIds: z.array(uuid).min(1).max(500).nullable().optional(),
});

courseAssignmentsRouter.patch('/:assignmentId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = patchBody.parse(req.body);
  await requirePermission(userId, orgId, 'assessments.create');
  const updated = await asUser(userId, async (db) => (await db.query(
    `update campus.course_assignments set
        status = coalesce($3, status),
        title = coalesce($4, title),
        instructions = case when $5::boolean then $6 else instructions end,
        due_at = case when $7::boolean then $8::timestamptz else due_at end,
        chapter_ids = case when $9::boolean then $10::uuid[] else chapter_ids end,
        updated_at = now()
      where id = $1 and org_id = $2
      returning id, title, status, due_at as "dueAt", chapter_ids as "chapterIds"`,
    [uuid.parse(req.params.assignmentId), orgId, body.status ?? null, body.title ?? null,
     body.instructions !== undefined, body.instructions ?? null,
     body.dueAt !== undefined, body.dueAt ?? null,
     body.chapterIds !== undefined, body.chapterIds ? [...new Set(body.chapterIds)] : null]
  )).rows[0]);
  if (!updated) throw notFound('Course assignment not found in this college.');
  if (body.status === 'published') await notifyCourseAssigned(updated.id);
  res.json(updated);
});

/** One row per student in the batch, including those who never opened the course. */
courseAssignmentsRouter.get('/:assignmentId/progress', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const assignmentId = uuid.parse(req.params.assignmentId);
  await requirePermission(userId, orgId, 'reports.view');

  const data = await asUser(userId, async (db) => {
    const assignment = (await db.query<AssignmentRow & { title: string; status: string; instructions: string | null; batch_name: string }>(
      `select a.id, a.batch_id, a.course_id, a.chapter_ids, a.due_at, a.title, a.status, a.instructions, b.name as batch_name
         from campus.course_assignments a join campus.batches b on b.id = a.batch_id
        where a.id = $1 and a.org_id = $2`, [assignmentId, orgId])).rows[0];
    if (!assignment) return null;
    const members = (await db.query<{ user_id: string; roll_number: string | null }>(
      `select user_id, roll_number from campus.course_assignment_students($1)`, [assignment.id])).rows;
    return { assignment, members };
  });
  if (!data) throw notFound('Course assignment not found in this college.');

  const { assignment, members } = data;
  const progress = await courseProgress(assignment, members.map((m) => m.user_id));
  const extra = await asSystem(async (db) => ({
    course: (await db.query<{ title: string }>(`select title from public.courses where id = $1`, [assignment.course_id])).rows[0],
    names: new Map((await db.query<{ id: string; full_name: string | null; email: string }>(
      `select id, full_name, email from public.users where id = any($1::uuid[])`, [members.map((m) => m.user_id)]
    )).rows.map((r) => [r.id, r])),
  }));

  const rows = members.map((m) => {
    const p = progress.students.get(m.user_id)!;
    return {
      userId: m.user_id, rollNumber: m.roll_number,
      name: extra.names.get(m.user_id)?.full_name ?? null, email: extra.names.get(m.user_id)?.email ?? null,
      ...p,
    };
  }).sort((a, b) => (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, { numeric: true }));

  const summary = {
    assigned: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    notStarted: rows.filter((r) => r.status === 'not_started').length,
    overdue: rows.filter((r) => r.status === 'overdue').length,
    averagePercent: rows.length ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : null,
  };
  const chapters = progress.chapters.map((c) => ({ id: c.id, number: c.chapter_number, title: c.title }));

  if (req.query.format === 'csv') {
    await requirePermission(userId, orgId, 'reports.export');
    await logExport(orgId, userId, 'course_progress', `Course progress: ${assignment.title} (${assignment.batch_name})`);
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = ['Roll number', 'Name', 'Email', 'Status', 'Chapters done', 'Out of', 'Percent', 'Last activity', 'Completed at',
      ...chapters.map((c) => `Ch ${c.number}: ${c.title}`)];
    const lines = [header, ...rows.map((r) => [
      r.rollNumber, r.name, r.email, STATUS_LABEL[r.status], r.completedChapters, r.totalChapters, r.percent,
      r.lastActivity ? new Date(r.lastActivity).toISOString() : '', r.completedAt ? new Date(r.completedAt).toISOString() : '',
      ...r.chapters.map((done) => (done ? 'Done' : '')),
    ])].map((cols) => cols.map(esc).join(','));
    const filename = `${assignment.title}-${assignment.batch_name}`.replace(/[^a-z0-9-]+/gi, '_').slice(0, 80);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send('﻿' + lines.join('\r\n'));
  }

  res.json({
    assignment: {
      id: assignment.id, title: assignment.title, status: assignment.status, instructions: assignment.instructions,
      dueAt: assignment.due_at, batch: assignment.batch_name, courseId: assignment.course_id,
      courseTitle: extra.course?.title ?? null, wholeCourse: assignment.chapter_ids === null,
    },
    chapters, summary, rows,
  });
});

// ── Students ────────────────────────────────────────────────────────────────
/** Published course assignments for my batches, with my own progress. */
export async function myCourseAssignments(userId: string) {
  const list = await asUser(userId, async (db) => (await db.query<AssignmentRow & {
    title: string; instructions: string | null; created_at: string; org_name: string; batch_name: string;
  }>(
    `select a.id, a.batch_id, a.course_id, a.chapter_ids, a.due_at, a.title, a.instructions, a.created_at,
            o.name as org_name, b.name as batch_name
       from campus.course_assignments a
       join campus.organizations o on o.id = a.org_id
       join campus.batches b on b.id = a.batch_id
      where a.status = 'published' and campus.is_course_assignment_target(a.id)
      order by a.due_at asc nulls last, a.created_at desc`)).rows);
  if (list.length === 0) return [];
  const courses = new Map(await asSystem(async (db) => (await db.query<{ id: string; title: string; slug: string; cover_image: string | null }>(
    `select id, title, slug, cover_image from public.courses where id = any($1::uuid[])`, [[...new Set(list.map((a) => a.course_id))]]
  )).rows.map((r) => [r.id, r] as [string, typeof r])));
  const out = [];
  for (const a of list) {
    const p = await courseProgress(a, [userId]);
    const mine = p.students.get(userId)!;
    const course = courses.get(a.course_id);
    out.push({
      id: a.id, title: a.title, instructions: a.instructions, dueAt: a.due_at, orgName: a.org_name, batchName: a.batch_name,
      courseId: a.course_id, courseTitle: course?.title ?? null, courseSlug: course?.slug ?? null, coverImage: course?.cover_image ?? null,
      wholeCourse: a.chapter_ids === null,
      chapters: p.chapters.map((c, i) => ({ id: c.id, number: c.chapter_number, title: c.title, done: mine.chapters[i] })),
      status: mine.status, completedChapters: mine.completedChapters, totalChapters: mine.totalChapters, percent: mine.percent,
    });
  }
  return out;
}
