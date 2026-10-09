import { randomBytes } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { badRequest, notFound } from '../errors';
import { requirePermission } from '../permissions';

export const testsRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const FORGE = '00000000-0000-0000-0000-00000000f0f0';
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

/** Tests this college can assign: its own, plus Forge's public library. */
testsRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'assessments.create');
  const tests = await asUser(userId, async (db) => (await db.query<{
    id: string; title: string; duration_seconds: number; is_published: boolean; owner_org_id: string; created_at: string;
  }>(
    `select id, title, duration_seconds, is_published, owner_org_id, created_at
       from public.tests
      where deleted_at is null
        and (owner_org_id = $1 or (owner_org_id = $2 and visibility = 'public' and is_published))
      order by (owner_org_id = $1) desc, created_at desc`,
    [orgId, FORGE]
  )).rows);
  // Question counts for Forge tests aren't visible to college staff via RLS; count by id.
  const counts = new Map(tests.length === 0 ? [] : await asSystem(async (db) => (await db.query<{ test_id: string; n: number }>(
    `select test_id, count(*)::int as n from public.test_questions where test_id = any($1::uuid[]) group by test_id`,
    [tests.map((t) => t.id)]
  )).rows.map((r) => [r.test_id, r.n] as [string, number])));
  res.json(tests.map((t) => ({
    id: t.id,
    title: t.title,
    durationMinutes: Math.round(t.duration_seconds / 60),
    published: t.is_published,
    source: t.owner_org_id === orgId ? 'college' : 'forge',
    questionCount: counts.get(t.id) ?? 0,
    createdAt: t.created_at,
  })));
});

const testBody = z.object({
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().max(5000).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600),
});

testsRouter.post('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = testBody.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  const slug = `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}-${randomBytes(4).toString('hex')}`;
  const created = await asUser(userId, async (db) => (await db.query(
    `insert into public.tests (slug, title, instructions, duration_seconds, owner_org_id, visibility, is_published)
     values ($1, $2, $3, $4, $5, 'org', false) returning id, title`,
    [slug, body.title, body.instructions ?? null, body.durationMinutes * 60, orgId]
  )).rows[0]);
  res.status(201).json(created);
});

/** A college test with its questions and answers — for the college's authors only. */
testsRouter.get('/:testId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'content.create');
  const testId = uuid.parse(req.params.testId);
  const result = await asUser(userId, async (db) => {
    const test = (await db.query(
      `select id, title, instructions, duration_seconds, is_published from public.tests
        where id = $1 and owner_org_id = $2 and deleted_at is null`, [testId, orgId])).rows[0];
    if (!test) return null;
    const questions = (await db.query(
      `select q.id, q.question_type as type, q.body, q.options, q.correct_options as "correctOptions",
              q.nat_answer as "natAnswer", q.nat_tolerance as "natTolerance", q.marks, q.negative_marks as "negativeMarks",
              q.topic, q.difficulty, q.explanation, q.starter_code as "starterCode",
              q.judge_config->>'compare' as compare, tq.sort_order as "sortOrder"
         from public.test_questions tq join public.testseries_questions q on q.id = tq.question_id
        where tq.test_id = $1 order by tq.sort_order, q.created_at`, [testId])).rows;
    // Authors see every test case, hidden ones included (RLS: content.create on this college).
    const cases = (await db.query<{ question_id: string; input: string; expected: string; isSample: boolean }>(
      `select question_id, input, expected_output as expected, is_sample as "isSample" from public.question_test_cases
        where question_id = any($1::uuid[]) order by sort_order, created_at`,
      [questions.filter((q) => q.type === 'coding').map((q) => q.id)])).rows;
    return { ...test, questions: questions.map((q) => q.type === 'coding'
      ? { ...q, tests: cases.filter((c) => c.question_id === q.id).map(({ question_id: _q, ...c }) => c) }
      : { ...q, starterCode: undefined, compare: undefined }) };
  });
  if (!result) throw notFound('Test not found in this college.');
  res.json({
    id: result.id, title: result.title, instructions: result.instructions,
    durationMinutes: Math.round(result.duration_seconds / 60), published: result.is_published,
    questions: result.questions.map((q: Record<string, unknown>) => ({
      ...q,
      marks: Number(q.marks),
      negativeMarks: Number(q.negativeMarks),
      natAnswer: q.natAnswer === null ? null : Number(q.natAnswer),
      natTolerance: Number(q.natTolerance),
    })),
  });
});

const testPatch = testBody.partial().extend({ published: z.boolean().optional() });

testsRouter.patch('/:testId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const body = testPatch.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  await asUser(userId, async (db) => {
    if (body.published) {
      const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.test_questions where test_id = $1`, [testId]);
      if (rows[0].n === 0) throw badRequest('Add at least one question before publishing.');
    }
    const { rowCount } = await db.query(
      `update public.tests set
          title = coalesce($3, title),
          instructions = case when $4::boolean then $5 else instructions end,
          duration_seconds = coalesce($6, duration_seconds),
          is_published = coalesce($7, is_published)
        where id = $1 and owner_org_id = $2`,
      [testId, orgId, body.title ?? null, body.instructions !== undefined, body.instructions ?? null,
       body.durationMinutes ? body.durationMinutes * 60 : null, body.published ?? null]
    );
    if (!rowCount) throw notFound('Test not found in this college.');
  });
  res.json({ ok: true });
});

const optionIds = 'abcdefghij'.split('');
const questionBody = z.object({
  type: z.enum(['mcq', 'msq', 'nat', 'coding']),
  body: z.string().trim().min(1).max(10_000),
  options: z.array(z.string().trim().min(1).max(2000)).min(2).max(10).optional(),
  correct: z.array(z.number().int().min(0).max(9)).optional(),
  natAnswer: z.number().finite().optional(),
  natTolerance: z.number().min(0).optional(),
  marks: z.number().positive().max(100).default(1),
  negativeMarks: z.number().min(0).max(100).default(0),
  topic: z.string().trim().max(120).nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  explanation: z.string().trim().max(10_000).nullable().optional(),
  // coding only
  starterCode: z.object({
    javascript: z.string().max(20_000), python: z.string().max(20_000), java: z.string().max(20_000), cpp: z.string().max(20_000),
  }).partial().strict().optional(),
  compare: z.enum(['exact', 'unordered', 'unordered_deep']).default('exact'),
  tests: z.array(z.object({
    input: z.string().trim().min(1).max(20_000),
    expected: z.string().trim().min(1).max(20_000),
    isSample: z.boolean().default(false),
  })).max(50).optional(),
}).superRefine((q, ctx) => {
  if (q.type === 'coding') {
    if (!q.starterCode || !Object.values(q.starterCode).some((c) => c?.trim())) {
      ctx.addIssue({ code: 'custom', path: ['starterCode'], message: 'Add starter code for at least one language.' });
    }
    if (!q.tests?.length) ctx.addIssue({ code: 'custom', path: ['tests'], message: 'Add at least one test case.' });
    else if (!q.tests.some((t) => t.isSample)) ctx.addIssue({ code: 'custom', path: ['tests'], message: 'Mark at least one test as a sample so students can try their code.' });
    return;
  }
  if (q.type === 'nat') {
    if (q.natAnswer === undefined) ctx.addIssue({ code: 'custom', path: ['natAnswer'], message: 'A numeric answer is required.' });
    return;
  }
  if (!q.options) { ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least two options.' }); return; }
  const correct = [...new Set(q.correct ?? [])];
  if (correct.some((i) => i >= q.options!.length)) ctx.addIssue({ code: 'custom', path: ['correct'], message: 'A correct answer points to a missing option.' });
  if (q.type === 'mcq' && correct.length !== 1) ctx.addIssue({ code: 'custom', path: ['correct'], message: 'Single-choice questions need exactly one correct option.' });
  if (q.type === 'msq' && correct.length < 1) ctx.addIssue({ code: 'custom', path: ['correct'], message: 'Mark at least one correct option.' });
});

testsRouter.post('/:testId/questions', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const q = questionBody.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  const choice = q.type === 'mcq' || q.type === 'msq';
  const options = choice ? q.options!.map((text, i) => ({ id: optionIds[i], text })) : null;
  const correct = choice ? [...new Set(q.correct!)].sort().map((i) => optionIds[i]) : null;
  const coding = q.type === 'coding';
  const created = await asUser(userId, async (db) => {
    const owns = (await db.query(`select 1 from public.tests where id = $1 and owner_org_id = $2`, [testId, orgId])).rowCount;
    if (!owns) throw notFound('Test not found in this college.');
    const question = (await db.query<{ id: string }>(
      `insert into public.testseries_questions
         (question_type, body, options, correct_options, nat_answer, nat_tolerance, marks, negative_marks,
          topic, difficulty, explanation, owner_org_id, visibility, starter_code, judge_config)
       values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, 'private', $13::jsonb, $14::jsonb) returning id`,
      [q.type, q.body, options ? JSON.stringify(options) : null, correct ? JSON.stringify(correct) : null,
       q.type === 'nat' ? q.natAnswer ?? null : null, q.natTolerance ?? 0, q.marks, q.type === 'mcq' ? q.negativeMarks : 0,
       q.topic ?? null, q.difficulty ?? null, q.explanation ?? null, orgId,
       JSON.stringify(coding ? Object.fromEntries(Object.entries(q.starterCode!).filter(([, c]) => c?.trim())) : {}), JSON.stringify(coding ? { compare: q.compare } : {})]
    )).rows[0];
    if (coding) {
      await db.query(
        `insert into public.question_test_cases (question_id, input, expected_output, is_sample, sort_order)
         select $1, t->>'input', t->>'expected', (t->>'isSample')::boolean, i::int
           from jsonb_array_elements($2::jsonb) with ordinality as x(t, i)`,
        [question.id, JSON.stringify(q.tests)]
      );
    }
    await db.query(
      `insert into public.test_questions (test_id, question_id, sort_order)
       values ($1, $2, coalesce((select max(sort_order) + 1 from public.test_questions where test_id = $1), 0))`,
      [testId, question.id]
    );
    return question;
  });
  res.status(201).json(created);
});

testsRouter.delete('/:testId/questions/:questionId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const questionId = uuid.parse(req.params.questionId);
  await requirePermission(userId, orgId, 'content.create');
  await asUser(userId, async (db) => {
    const { rowCount } = await db.query(`delete from public.test_questions where test_id = $1 and question_id = $2`, [testId, questionId]);
    if (!rowCount) throw notFound('Question not found in this test.');
    // Remove the question itself once no test uses it.
    await db.query(
      `delete from public.testseries_questions q where q.id = $1 and q.owner_org_id = $2
         and not exists (select 1 from public.test_questions tq where tq.question_id = q.id)`,
      [questionId, orgId]
    );
  });
  res.status(204).end();
});
