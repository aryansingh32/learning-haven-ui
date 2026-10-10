import { randomBytes } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser, Db } from '../db';
import { badRequest, notFound } from '../errors';
import { requirePermission } from '../permissions';

/**
 * Content a college makes for its own students: courses (chapters + steps), practice
 * problems (with judged tests), test series (its own tests, e.g. aptitude sets) and
 * study materials. Everything is owned by the college (owner_org_id) with visibility
 * 'org', so only that college's people see it in the Forge app.
 *
 * Courses, chapters, steps and problems have no browser access in the database, so
 * writes go through asSystem — always after requirePermission(content.create) and
 * always constrained to rows the college owns.
 */
export const contentRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);
const slugFor = (title: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item'}-${randomBytes(3).toString('hex')}`;

async function staff(req: { params: Record<string, string> }) {
  const userId = userOf(req as never);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'content.create');
  return { userId, orgId };
}

async function ownedCourse(db: Db, orgId: string, courseId: string) {
  const ok = (await db.query(`select 1 from public.courses where id = $1 and owner_org_id = $2 and deleted_at is null`, [courseId, orgId])).rowCount;
  if (!ok) throw notFound('Course not found.');
}

async function ownedChapter(db: Db, orgId: string, chapterId: string) {
  const row = (await db.query<{ course_id: string }>(
    `select ch.course_id from public.chapters ch join public.courses c on c.id = ch.course_id
      where ch.id = $1 and c.owner_org_id = $2 and c.deleted_at is null`, [chapterId, orgId])).rows[0];
  if (!row) throw notFound('Chapter not found.');
  return row.course_id;
}

// ── Courses ─────────────────────────────────────────────────────────────────
contentRouter.get('/courses', async (req, res) => {
  const { orgId } = await staff(req);
  res.json(await asSystem(async (db) => (await db.query(
    `select c.id, c.title, c.slug, c.description, c.difficulty_level as difficulty, c.cover_image as "coverImage",
            c.is_published as published, c.updated_at as "updatedAt",
            (select count(*) from public.chapters ch where ch.course_id = c.id)::int as chapters,
            (select count(*) from public.course_enrollments e where e.course_id = c.id)::int as enrolled
       from public.courses c where c.owner_org_id = $1 and c.deleted_at is null order by c.created_at desc`, [orgId])).rows));
});

const courseBody = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  coverImage: z.string().trim().url().max(2000).nullable().optional(),
});

contentRouter.post('/courses', async (req, res) => {
  const { orgId, userId } = await staff(req);
  const b = courseBody.parse(req.body);
  res.status(201).json(await asSystem(async (db) => (await db.query(
    `insert into public.courses (title, slug, description, difficulty_level, cover_image, type, is_premium, is_published, owner_org_id, visibility, created_by)
     values ($1, $2, $3, $4, $5, 'custom', false, false, $6, 'org', $7) returning id, title, slug`,
    [b.title, slugFor(b.title), b.description ?? null, b.difficulty, b.coverImage ?? null, orgId, userId])).rows[0]));
});

contentRouter.patch('/courses/:courseId', async (req, res) => {
  const { orgId } = await staff(req);
  const courseId = uuid.parse(req.params.courseId);
  const b = courseBody.partial().extend({ published: z.boolean().optional() }).parse(req.body);
  await asSystem(async (db) => {
    await ownedCourse(db, orgId, courseId);
    if (b.published) {
      const n = (await db.query<{ n: number }>(`select count(*)::int as n from public.chapters where course_id = $1`, [courseId])).rows[0].n;
      if (n === 0) throw badRequest('Add at least one chapter before publishing.');
    }
    await db.query(
      `update public.courses set title = coalesce($3, title), description = case when $4::boolean then $5 else description end,
              difficulty_level = coalesce($6, difficulty_level), cover_image = case when $7::boolean then $8 else cover_image end,
              is_published = coalesce($9, is_published), updated_at = now()
        where id = $1 and owner_org_id = $2`,
      [courseId, orgId, b.title ?? null, b.description !== undefined, b.description ?? null, b.difficulty ?? null,
       b.coverImage !== undefined, b.coverImage ?? null, b.published ?? null]);
  });
  res.json({ ok: true });
});

contentRouter.delete('/courses/:courseId', async (req, res) => {
  const { orgId } = await staff(req);
  const courseId = uuid.parse(req.params.courseId);
  const n = await asSystem(async (db) => (await db.query(
    `update public.courses set deleted_at = now(), is_published = false where id = $1 and owner_org_id = $2 and deleted_at is null`, [courseId, orgId])).rowCount);
  if (!n) throw notFound('Course not found.');
  res.status(204).end();
});

contentRouter.get('/courses/:courseId', async (req, res) => {
  const { orgId } = await staff(req);
  const courseId = uuid.parse(req.params.courseId);
  res.json(await asSystem(async (db) => {
    const course = (await db.query(
      `select id, title, slug, description, difficulty_level as difficulty, cover_image as "coverImage", is_published as published
         from public.courses where id = $1 and owner_org_id = $2 and deleted_at is null`, [courseId, orgId])).rows[0];
    if (!course) throw notFound('Course not found.');
    const chapters = (await db.query(
      `select ch.id, ch.chapter_number as number, ch.title, ch.story_hook as "storyHook", ch.est_minutes as "estMinutes",
              coalesce((select json_agg(json_build_object('id', s.id, 'type', s.type, 'title', s.title, 'content', s.content) order by s.step_number)
                          from public.steps s where s.chapter_id = ch.id), '[]') as steps
         from public.chapters ch where ch.course_id = $1 order by ch.chapter_number`, [courseId])).rows;
    return { ...course, chapters };
  }));
});

const chapterBody = z.object({
  title: z.string().trim().min(2).max(200),
  storyHook: z.string().trim().max(2000).nullable().optional(),
  estMinutes: z.number().int().min(1).max(1440).default(30),
});

contentRouter.post('/courses/:courseId/chapters', async (req, res) => {
  const { orgId } = await staff(req);
  const courseId = uuid.parse(req.params.courseId);
  const b = chapterBody.parse(req.body);
  res.status(201).json(await asSystem(async (db) => {
    await ownedCourse(db, orgId, courseId);
    const next = (await db.query<{ n: number }>(`select coalesce(max(chapter_number), 0) + 1 as n from public.chapters where course_id = $1`, [courseId])).rows[0].n;
    return (await db.query(
      `insert into public.chapters (course_id, chapter_number, title, topic_tag, difficulty, story_hook, est_minutes, is_active)
       values ($1, $2, $3, $4, 'BEGINNER', $5, $6, true) returning id, chapter_number as number, title`,
      [courseId, next, b.title, b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), b.storyHook ?? null, b.estMinutes])).rows[0];
  }));
});

contentRouter.patch('/chapters/:chapterId', async (req, res) => {
  const { orgId } = await staff(req);
  const chapterId = uuid.parse(req.params.chapterId);
  const b = chapterBody.partial().parse(req.body);
  await asSystem(async (db) => {
    await ownedChapter(db, orgId, chapterId);
    await db.query(
      `update public.chapters set title = coalesce($2, title), story_hook = case when $3::boolean then $4 else story_hook end,
              est_minutes = coalesce($5, est_minutes) where id = $1`,
      [chapterId, b.title ?? null, b.storyHook !== undefined, b.storyHook ?? null, b.estMinutes ?? null]);
  });
  res.json({ ok: true });
});

contentRouter.delete('/chapters/:chapterId', async (req, res) => {
  const { orgId } = await staff(req);
  const chapterId = uuid.parse(req.params.chapterId);
  await asSystem(async (db) => {
    const courseId = await ownedChapter(db, orgId, chapterId);
    await db.query(`delete from public.chapters where id = $1`, [chapterId]);
    // Keep chapter numbers 1..n so "previous chapter" unlocking stays right.
    await db.query(
      `update public.chapters ch set chapter_number = r.n
         from (select id, row_number() over (order by chapter_number) as n from public.chapters where course_id = $1) r
        where ch.id = r.id`, [courseId]);
  });
  res.status(204).end();
});

const quizQuestion = z.object({
  question: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correctAnswer: z.string().trim().min(1).max(500),
  explanation: z.string().trim().max(2000).optional(),
}).refine((q) => q.options.includes(q.correctAnswer), { message: 'The correct answer must be one of the options.' });

// The step types the Forge chapter page renders, with the content each needs.
const stepBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('story_hook'), title: z.string().trim().max(200).default('Story'), content: z.object({ story: z.string().trim().min(1).max(5000) }) }),
  z.object({ type: z.literal('video'), title: z.string().trim().max(200).default('Video'), content: z.object({
    title: z.string().trim().max(200).optional(), channel: z.string().trim().max(120).optional(), focus_note: z.string().trim().max(1000).optional(),
    youtube_url: z.string().trim().regex(/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//, 'Use a YouTube link.'),
  }) }),
  z.object({ type: z.literal('doc'), title: z.string().trim().max(200).default('Reading'), content: z.object({ doc_md: z.string().trim().min(1).max(100_000) }) }),
  z.object({ type: z.literal('quiz'), title: z.string().trim().max(200).default('Quiz'), content: z.object({ quiz_questions: z.array(quizQuestion).min(1).max(30) }) }),
  z.object({ type: z.literal('task'), title: z.string().trim().max(200).default('Task'), content: z.object({ task_prompt: z.string().trim().min(1).max(5000) }) }),
]);

/** Replaces a chapter's steps (the editor saves the whole ordered list). */
contentRouter.put('/chapters/:chapterId/steps', async (req, res) => {
  const { orgId } = await staff(req);
  const chapterId = uuid.parse(req.params.chapterId);
  const steps = z.array(stepBody).max(30).parse(req.body?.steps);
  await asSystem(async (db) => {
    await ownedChapter(db, orgId, chapterId);
    // asSystem runs in one transaction: a bad step leaves the old ones in place.
    await db.query(`delete from public.steps where chapter_id = $1`, [chapterId]);
    for (const [i, s] of steps.entries()) {
      await db.query(`insert into public.steps (chapter_id, step_number, type, title, content) values ($1, $2, $3, $4, $5::jsonb)`,
        [chapterId, i + 1, s.type, s.title, JSON.stringify(s.content)]);
    }
  });
  res.json({ saved: steps.length });
});

// ── Practice problems ───────────────────────────────────────────────────────
const LANGS = ['javascript', 'python', 'java', 'cpp'] as const;
const problemBody = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(20_000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topic: z.string().trim().min(2).max(80),
  hints: z.array(z.string().trim().min(1).max(1000)).max(10).default([]),
  constraints: z.string().trim().max(5000).nullable().optional(),
  starterCode: z.object(Object.fromEntries(LANGS.map((l) => [l, z.string().max(20_000)])) as Record<(typeof LANGS)[number], z.ZodString>).partial().strict(),
  compare: z.enum(['exact', 'unordered', 'unordered_deep']).default('exact'),
  editorial: z.string().trim().max(50_000).nullable().optional(),
  tests: z.array(z.object({
    input: z.string().trim().min(1).max(20_000),
    expected: z.string().trim().min(1).max(20_000),
    isSample: z.boolean().default(false),
    explanation: z.string().trim().max(1000).optional(),
  })).min(1).max(50),
}).superRefine((p, ctx) => {
  if (!Object.values(p.starterCode).some((c) => c?.trim())) ctx.addIssue({ code: 'custom', path: ['starterCode'], message: 'Add starter code for at least one language.' });
  if (!p.tests.some((t) => t.isSample)) ctx.addIssue({ code: 'custom', path: ['tests'], message: 'Mark at least one test as a sample.' });
});

contentRouter.get('/problems', async (req, res) => {
  const { orgId } = await staff(req);
  res.json(await asSystem(async (db) => (await db.query(
    `select p.id, p.slug, p.title, p.difficulty, p.topic, p.visibility = 'org' and p.deleted_at is null as published,
            (select count(*) from public.problem_test_cases t where t.problem_id = p.id)::int as tests,
            (select count(distinct s.user_id) from public.problem_submissions s where s.problem_id = p.id and s.verdict = 'Accepted')::int as solvers,
            p.updated_at as "updatedAt"
       from public.problems p where p.owner_org_id = $1 and p.deleted_at is null order by p.created_at desc`, [orgId])).rows));
});

contentRouter.get('/problems/:problemId', async (req, res) => {
  const { orgId } = await staff(req);
  const problemId = uuid.parse(req.params.problemId);
  res.json(await asSystem(async (db) => {
    const p = (await db.query(
      `select id, slug, title, description, difficulty, topic, hints, constraints, starter_code as "starterCode",
              judge_config->>'compare' as compare, solution_explanation as editorial, visibility = 'org' as published
         from public.problems where id = $1 and owner_org_id = $2 and deleted_at is null`, [problemId, orgId])).rows[0];
    if (!p) throw notFound('Problem not found.');
    const tests = (await db.query(
      `select input, expected_output as expected, is_sample as "isSample", explanation from public.problem_test_cases where problem_id = $1 order by sort_order`,
      [problemId])).rows;
    return { ...p, tests };
  }));
});

async function writeProblemTests(db: Db, problemId: string, tests: z.infer<typeof problemBody>['tests']) {
  await db.query(`delete from public.problem_test_cases where problem_id = $1`, [problemId]);
  for (const [i, t] of tests.entries()) {
    await db.query(
      `insert into public.problem_test_cases (problem_id, input, expected_output, is_sample, explanation, sort_order) values ($1, $2, $3, $4, $5, $6)`,
      [problemId, t.input, t.expected, t.isSample, t.explanation ?? null, i + 1]);
  }
}

contentRouter.post('/problems', async (req, res) => {
  const { orgId } = await staff(req);
  const b = problemBody.parse(req.body);
  res.status(201).json(await asSystem(async (db) => {
    {
      // Drafts are 'private'; publishing makes them 'org' (the college's students).
      const p = (await db.query<{ id: string; slug: string }>(
        `insert into public.problems (slug, title, description, difficulty, topic, hints, constraints, starter_code, judge_config,
                                      solution_explanation, is_premium, owner_org_id, visibility, order_index)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, false, $11, 'private', 100000) returning id, slug`,
        [slugFor(b.title), b.title, b.description, b.difficulty, b.topic, b.hints, b.constraints ?? null, JSON.stringify(b.starterCode),
         JSON.stringify({ compare: b.compare }), b.editorial ?? null, orgId])).rows[0];
      await writeProblemTests(db, p.id, b.tests);
      return p;
    }
  }));
});

contentRouter.put('/problems/:problemId', async (req, res) => {
  const { orgId } = await staff(req);
  const problemId = uuid.parse(req.params.problemId);
  const b = problemBody.parse(req.body);
  await asSystem(async (db) => {
    {
      const n = (await db.query(
        `update public.problems set title = $3, description = $4, difficulty = $5, topic = $6, hints = $7, constraints = $8,
                starter_code = $9::jsonb, judge_config = $10::jsonb, solution_explanation = $11, updated_at = now()
          where id = $1 and owner_org_id = $2 and deleted_at is null`,
        [problemId, orgId, b.title, b.description, b.difficulty, b.topic, b.hints, b.constraints ?? null, JSON.stringify(b.starterCode),
         JSON.stringify({ compare: b.compare }), b.editorial ?? null])).rowCount;
      if (!n) throw notFound('Problem not found.');
      await writeProblemTests(db, problemId, b.tests);
    }
  });
  res.json({ ok: true });
});

contentRouter.patch('/problems/:problemId', async (req, res) => {
  const { orgId } = await staff(req);
  const problemId = uuid.parse(req.params.problemId);
  const { published } = z.object({ published: z.boolean() }).parse(req.body);
  const n = await asSystem(async (db) => (await db.query(
    `update public.problems set visibility = $3, updated_at = now() where id = $1 and owner_org_id = $2 and deleted_at is null`,
    [problemId, orgId, published ? 'org' : 'private'])).rowCount);
  if (!n) throw notFound('Problem not found.');
  res.json({ ok: true });
});

contentRouter.delete('/problems/:problemId', async (req, res) => {
  const { orgId } = await staff(req);
  const problemId = uuid.parse(req.params.problemId);
  const n = await asSystem(async (db) => (await db.query(
    `update public.problems set deleted_at = now() where id = $1 and owner_org_id = $2 and deleted_at is null`, [problemId, orgId])).rowCount);
  if (!n) throw notFound('Problem not found.');
  res.status(204).end();
});

// ── Test series (practice tests, aptitude sets) ─────────────────────────────
contentRouter.get('/test-series', async (req, res) => {
  const { orgId } = await staff(req);
  res.json(await asSystem(async (db) => ({
    categories: (await db.query(
      `select id, name from public.exam_categories where is_active and owner_org_id = '00000000-0000-0000-0000-00000000f0f0' order by sort_order, name`)).rows,
    series: (await db.query(
      `select s.id, s.title, s.description, s.exam_category_id as "categoryId", s.is_published as published,
              coalesce((select json_agg(json_build_object('id', t.id, 'title', t.title, 'published', t.is_published,
                         'questions', (select count(*) from public.test_questions q where q.test_id = t.id)) order by t.sort_order)
                          from public.tests t where t.test_series_id = s.id and t.deleted_at is null), '[]') as tests
         from public.test_series s where s.owner_org_id = $1 and s.deleted_at is null order by s.created_at desc`, [orgId])).rows,
  })));
});

const seriesBody = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: uuid,
});

contentRouter.post('/test-series', async (req, res) => {
  const { orgId } = await staff(req);
  const b = seriesBody.parse(req.body);
  res.status(201).json(await asSystem(async (db) => {
    const cat = (await db.query(`select 1 from public.exam_categories where id = $1 and is_active and owner_org_id = '00000000-0000-0000-0000-00000000f0f0'`, [b.categoryId])).rowCount;
    if (!cat) throw badRequest('Choose one of the listed categories.');
    return (await db.query(
      `insert into public.test_series (exam_category_id, slug, title, description, is_free, price, is_published, owner_org_id, visibility)
       values ($1, $2, $3, $4, true, 0, false, $5, 'org') returning id, title`,
      [b.categoryId, slugFor(b.title), b.title, b.description ?? null, orgId])).rows[0];
  }));
});

contentRouter.patch('/test-series/:seriesId', async (req, res) => {
  const { orgId } = await staff(req);
  const seriesId = uuid.parse(req.params.seriesId);
  const b = seriesBody.partial().extend({ published: z.boolean().optional() }).parse(req.body);
  await asSystem(async (db) => {
    const s = (await db.query(`select 1 from public.test_series where id = $1 and owner_org_id = $2 and deleted_at is null`, [seriesId, orgId])).rowCount;
    if (!s) throw notFound('Test series not found.');
    if (b.published) {
      const ready = (await db.query<{ n: number }>(
        `select count(*)::int as n from public.tests t where t.test_series_id = $1 and t.deleted_at is null
            and exists (select 1 from public.test_questions q where q.test_id = t.id)`, [seriesId])).rows[0].n;
      if (!ready) throw badRequest('Add a test with questions before publishing.');
    }
    await db.query(
      `update public.test_series set title = coalesce($3, title), description = case when $4::boolean then $5 else description end,
              is_published = coalesce($6, is_published), updated_at = now() where id = $1 and owner_org_id = $2`,
      [seriesId, orgId, b.title ?? null, b.description !== undefined, b.description ?? null, b.published ?? null]);
    // A published series' tests are practice tests for the college's students.
    if (b.published !== undefined) {
      await db.query(`update public.tests set is_published = $2 where test_series_id = $1 and owner_org_id = $3 and deleted_at is null`,
        [seriesId, b.published, orgId]);
    }
  });
  res.json({ ok: true });
});

contentRouter.delete('/test-series/:seriesId', async (req, res) => {
  const { orgId } = await staff(req);
  const seriesId = uuid.parse(req.params.seriesId);
  await asSystem(async (db) => {
    const n = (await db.query(`update public.test_series set deleted_at = now(), is_published = false where id = $1 and owner_org_id = $2 and deleted_at is null`,
      [seriesId, orgId])).rowCount;
    if (!n) throw notFound('Test series not found.');
    await db.query(`update public.tests set test_series_id = null, is_published = false where test_series_id = $1 and owner_org_id = $2`, [seriesId, orgId]);
  });
  res.status(204).end();
});

/** Puts one of the college's own tests (built on the Tests page) into a series. */
contentRouter.post('/test-series/:seriesId/tests', async (req, res) => {
  const { orgId } = await staff(req);
  const seriesId = uuid.parse(req.params.seriesId);
  const { testId } = z.object({ testId: uuid }).parse(req.body);
  await asSystem(async (db) => {
    const s = (await db.query<{ is_published: boolean }>(`select is_published from public.test_series where id = $1 and owner_org_id = $2 and deleted_at is null`,
      [seriesId, orgId])).rows[0];
    if (!s) throw notFound('Test series not found.');
    // A test given to a batch as an exam stays an exam: practice copies must be separate tests.
    const assigned = (await db.query(`select 1 from campus.assignments where test_id = $1`, [testId])).rowCount;
    if (assigned) throw badRequest('This test is used as an exam. Make a copy for practice instead.');
    // The self-paced Test Series player handles choice, multi-choice, true/false and numeric questions.
    const unsupported = (await db.query(
      `select 1 from public.test_questions tq join public.testseries_questions q on q.id = tq.question_id
        where tq.test_id = $1 and q.question_type not in ('mcq', 'msq', 'nat', 'tf') limit 1`, [testId])).rowCount;
    if (unsupported) throw badRequest('Practice tests can only have multiple-choice, true/false and numeric questions.');
    const n = (await db.query(
      `update public.tests set test_series_id = $1, is_published = $3,
              sort_order = coalesce((select max(sort_order) + 1 from public.tests where test_series_id = $1), 1)
        where id = $2 and owner_org_id = $4 and deleted_at is null`, [seriesId, testId, s.is_published, orgId])).rowCount;
    if (!n) throw notFound('Test not found.');
  });
  res.status(201).json({ ok: true });
});

contentRouter.delete('/test-series/:seriesId/tests/:testId', async (req, res) => {
  const { orgId } = await staff(req);
  const seriesId = uuid.parse(req.params.seriesId);
  const testId = uuid.parse(req.params.testId);
  const n = await asSystem(async (db) => (await db.query(
    `update public.tests set test_series_id = null, is_published = false where id = $1 and test_series_id = $2 and owner_org_id = $3`,
    [testId, seriesId, orgId])).rowCount);
  if (!n) throw notFound('Test not found in this series.');
  res.status(204).end();
});

// ── Study materials (RLS decides: content staff of this college) ─────────────
const materialBody = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['note', 'link', 'file']),
  body: z.string().max(100_000).nullable().optional(),
  url: z.string().trim().url().max(2000).nullable().optional(),
  batchId: uuid.nullable().optional(),
  courseId: uuid.nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
  published: z.boolean().default(false),
}).superRefine((m, ctx) => {
  if (m.kind === 'note' && !m.body?.trim()) ctx.addIssue({ code: 'custom', path: ['body'], message: 'Write the note.' });
  if (m.kind !== 'note' && !m.url) ctx.addIssue({ code: 'custom', path: ['url'], message: 'Add the link.' });
});

const MATERIAL = `id, title, kind, body, url, batch_id as "batchId", course_id as "courseId", tags, is_published as published,
                  created_at as "createdAt", updated_at as "updatedAt"`;

contentRouter.get('/materials', async (req, res) => {
  const { orgId, userId } = await staff(req);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select ${MATERIAL} from campus.study_materials where org_id = $1 order by created_at desc`, [orgId])).rows));
});

contentRouter.post('/materials', async (req, res) => {
  const { orgId, userId } = await staff(req);
  const b = materialBody.parse(req.body);
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.study_materials (org_id, batch_id, course_id, title, kind, body, url, tags, is_published, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning ${MATERIAL}`,
    [orgId, b.batchId ?? null, b.courseId ?? null, b.title, b.kind, b.kind === 'note' ? b.body ?? '' : null,
     b.kind === 'note' ? null : b.url ?? null, b.tags, b.published, userId])).rows[0]));
});

contentRouter.put('/materials/:materialId', async (req, res) => {
  const { orgId, userId } = await staff(req);
  const materialId = uuid.parse(req.params.materialId);
  const b = materialBody.parse(req.body);
  const row = await asUser(userId, async (db) => (await db.query(
    `update campus.study_materials set batch_id = $3, course_id = $4, title = $5, kind = $6, body = $7, url = $8, tags = $9, is_published = $10
      where id = $1 and org_id = $2 returning ${MATERIAL}`,
    [materialId, orgId, b.batchId ?? null, b.courseId ?? null, b.title, b.kind, b.kind === 'note' ? b.body ?? '' : null,
     b.kind === 'note' ? null : b.url ?? null, b.tags, b.published])).rows[0]);
  if (!row) throw notFound('Material not found.');
  res.json(row);
});

contentRouter.delete('/materials/:materialId', async (req, res) => {
  const { orgId, userId } = await staff(req);
  const materialId = uuid.parse(req.params.materialId);
  const n = await asUser(userId, async (db) => (await db.query(`delete from campus.study_materials where id = $1 and org_id = $2`, [materialId, orgId])).rowCount);
  if (!n) throw notFound('Material not found.');
  res.status(204).end();
});
