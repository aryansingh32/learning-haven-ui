import { randomBytes } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser, Db } from '../db';
import { badRequest, notFound } from '../errors';
import { requirePermission } from '../permissions';
import { parseQuestionSheet, SheetQuestion } from '@repo/assessment-core';

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
    shared_to_me: boolean; shared_with: number;
  }>(
    `select t.id, t.title, t.duration_seconds, t.is_published, t.owner_org_id, t.created_at,
            exists (select 1 from campus.test_shares s where s.test_id = t.id and s.org_id = $1) as shared_to_me,
            (select count(*) from campus.test_shares s where s.test_id = t.id and s.owner_org_id = $1)::int as shared_with
       from public.tests t
      where t.deleted_at is null
        and (t.owner_org_id = $1 or (t.owner_org_id = $2 and t.visibility = 'public' and t.is_published)
             or (t.is_published and exists (select 1 from campus.test_shares s where s.test_id = t.id and s.org_id = $1)))
      order by (t.owner_org_id = $1) desc, t.created_at desc`,
    [orgId, FORGE]
  )).rows);
  // Question counts for Forge tests aren't visible to college staff via RLS; count by id.
  const counts = new Map(tests.length === 0 ? [] : await asSystem(async (db) => (await db.query<{ test_id: string; n: number }>(
    `select test_id, count(*)::int as n from public.test_questions where test_id = any($1::uuid[]) group by test_id`,
    [tests.map((t) => t.id)]
  )).rows.map((r) => [r.test_id, r.n] as [string, number])));
  // Other colleges' names aren't readable to staff under RLS; look up the sharers by id.
  const sharers = new Map(tests.some((t) => t.shared_to_me) ? await asSystem(async (db) => (await db.query<{ id: string; name: string }>(
    `select id, name from campus.organizations where id = any($1::uuid[])`,
    [[...new Set(tests.filter((t) => t.shared_to_me).map((t) => t.owner_org_id))]])).rows.map((r) => [r.id, r.name] as [string, string])) : []);
  res.json(tests.map((t) => ({
    id: t.id,
    title: t.title,
    durationMinutes: Math.round(t.duration_seconds / 60),
    published: t.is_published,
    source: t.owner_org_id === orgId ? 'college' : t.shared_to_me ? 'shared' : 'forge',
    sharedBy: t.shared_to_me ? sharers.get(t.owner_org_id) ?? null : null,
    sharedWith: t.shared_with,
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
      `select id, title, instructions, duration_seconds, is_published, section_time_locked, draw_count from public.tests
        where id = $1 and owner_org_id = $2 and deleted_at is null`, [testId, orgId])).rows[0];
    if (!test) return null;
    const questions = (await db.query(
      `select q.id, q.question_type as type, q.body, q.options, q.correct_options as "correctOptions",
              q.nat_answer as "natAnswer", q.nat_tolerance as "natTolerance", q.marks, q.negative_marks as "negativeMarks",
              q.topic, q.difficulty, q.explanation, q.starter_code as "starterCode",
              q.judge_config->>'compare' as compare, tq.sort_order as "sortOrder", tq.section_id as "sectionId",
              q.tags, q.text_answers as "acceptedAnswers", coalesce((q.judge_config->>'caseSensitive')::boolean, false) as "caseSensitive",
              q.rubric, q.max_words as "maxWords"
         from public.test_questions tq join public.testseries_questions q on q.id = tq.question_id
        where tq.test_id = $1 order by tq.sort_order, q.created_at`, [testId])).rows;
    // Authors see every test case, hidden ones included (RLS: content.create on this college).
    const cases = (await db.query<{ question_id: string; input: string; expected: string; isSample: boolean }>(
      `select question_id, input, expected_output as expected, is_sample as "isSample" from public.question_test_cases
        where question_id = any($1::uuid[]) order by sort_order, created_at`,
      [questions.filter((q) => q.type === 'coding').map((q) => q.id)])).rows;
    const sections = (await db.query(
      `select id, name, duration_seconds, draw_count, sort_order from public.test_sections where test_id = $1 order by sort_order, created_at`,
      [testId])).rows;
    return { ...test, sections, questions: questions.map((q) => q.type === 'coding'
      ? { ...q, tests: cases.filter((c) => c.question_id === q.id).map(({ question_id: _q, ...c }) => c) }
      : { ...q, starterCode: undefined, compare: undefined }) };
  });
  if (!result) throw notFound('Test not found in this college.');
  res.json({
    id: result.id, title: result.title, instructions: result.instructions,
    durationMinutes: Math.round(result.duration_seconds / 60), published: result.is_published,
    sectionTimeLocked: result.section_time_locked,
    // Pool for questions not in any section: deal this many of them to each student.
    drawCount: result.draw_count,
    sections: result.sections.map((x: { id: string; name: string; duration_seconds: number | null; draw_count: number | null }) => ({
      id: x.id, name: x.name, durationMinutes: x.duration_seconds === null ? null : Math.round(x.duration_seconds / 60),
      drawCount: x.draw_count,
      questionCount: result.questions.filter((q: { sectionId: string | null }) => q.sectionId === x.id).length,
    })),
    questions: result.questions.map((q: Record<string, unknown>) => ({
      ...q,
      marks: Number(q.marks),
      negativeMarks: Number(q.negativeMarks),
      natAnswer: q.natAnswer === null ? null : Number(q.natAnswer),
      natTolerance: Number(q.natTolerance),
    })),
  });
});

const testPatch = testBody.partial().extend({
  published: z.boolean().optional(),
  sectionTimeLocked: z.boolean().optional(),
  drawCount: z.number().int().min(1).max(500).nullable().optional(),
});

/** Why the test's question pools aren't valid yet (null when they are). */
async function poolProblem(db: Db, testId: string): Promise<string | null> {
  const { rows } = await db.query<{ name: string; draw: number; size: number; marks: number; grouped: number }>(
    `with pools as (
       select s.id, s.name, s.draw_count as draw from public.test_sections s where s.test_id = $1 and s.draw_count is not null
       union all
       select null, 'Questions not in a section', t.draw_count from public.tests t where t.id = $1 and t.draw_count is not null
     )
     select p.name, p.draw,
            count(q.question_id)::int as size,
            count(distinct qq.marks)::int as marks,
            count(qq.question_group_id)::int as grouped
       from pools p
       left join public.test_questions q on q.test_id = $1 and q.section_id is not distinct from p.id
       left join public.testseries_questions qq on qq.id = q.question_id
      group by p.id, p.name, p.draw`, [testId]);
  for (const r of rows) {
    if (r.draw > r.size) return `${r.name}: it deals ${r.draw} questions but has only ${r.size}.`;
    if (r.marks > 1) return `${r.name}: give every question in a pool the same marks, so all students can score the same total.`;
    if (r.grouped > 0) return `${r.name}: passage-based questions can't be in a pool yet.`;
  }
  return null;
}

/** Why a timed-section test can't be published yet (null when it can). */
async function timedSectionProblem(db: Db, testId: string): Promise<string | null> {
  const { rows } = await db.query<{ locked: boolean; sections: number; untimed: number; empty: number; loose: number }>(
    `select t.section_time_locked as locked,
            (select count(*)::int from public.test_sections s where s.test_id = t.id) as sections,
            (select count(*)::int from public.test_sections s where s.test_id = t.id and s.duration_seconds is null
                and exists (select 1 from public.test_questions q where q.section_id = s.id)) as untimed,
            (select count(*)::int from public.test_sections s where s.test_id = t.id
                and not exists (select 1 from public.test_questions q where q.section_id = s.id)) as empty,
            (select count(*)::int from public.test_questions q where q.test_id = t.id and q.section_id is null) as loose
       from public.tests t where t.id = $1`, [testId]);
  const r = rows[0];
  if (!r?.locked) return null;
  if (r.sections === 0) return 'Timed sections are on: add at least one section.';
  if (r.untimed > 0) return 'Give every section a time limit.';
  if (r.loose > 0) return 'Timed sections are on: put every question in a section.';
  if (r.empty === r.sections) return 'Add questions to your sections.';
  return null;
}

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
    if (body.drawCount !== undefined) {
      await db.query(`update public.tests set draw_count = $3 where id = $1 and owner_org_id = $2`, [testId, orgId, body.drawCount]);
    }
    if (body.sectionTimeLocked !== undefined) {
      await db.query(`update public.tests set section_time_locked = $3 where id = $1 and owner_org_id = $2`, [testId, orgId, body.sectionTimeLocked]);
    }
    if (body.published) {
      const problem = (await timedSectionProblem(db, testId)) ?? (await poolProblem(db, testId));
      if (problem) throw badRequest(problem);
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
  type: z.enum(['mcq', 'msq', 'nat', 'coding', 'tf', 'fib', 'descriptive']),
  body: z.string().trim().min(1).max(10_000),
  options: z.array(z.string().trim().min(1).max(2000)).min(2).max(10).optional(),
  correct: z.array(z.number().int().min(0).max(9)).optional(),
  natAnswer: z.number().finite().optional(),
  natTolerance: z.number().min(0).optional(),
  marks: z.number().positive().max(100).default(1),
  sectionId: z.string().uuid().nullable().optional(),
  negativeMarks: z.number().min(0).max(100).default(0),
  topic: z.string().trim().max(120).nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  explanation: z.string().trim().max(10_000).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
  // tf: is the statement true?
  answerTrue: z.boolean().optional(),
  // fib: accepted answers; compared ignoring case unless caseSensitive
  acceptedAnswers: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  caseSensitive: z.boolean().default(false),
  // descriptive: marking guide and an optional word limit
  rubric: z.string().trim().max(5000).nullable().optional(),
  maxWords: z.number().int().min(1).max(5000).nullable().optional(),
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
  if (q.type === 'tf') {
    if (q.answerTrue === undefined) ctx.addIssue({ code: 'custom', path: ['answerTrue'], message: 'Say whether the statement is true or false.' });
    return;
  }
  if (q.type === 'fib') {
    if (!q.acceptedAnswers?.length) ctx.addIssue({ code: 'custom', path: ['acceptedAnswers'], message: 'Add at least one accepted answer.' });
    return;
  }
  if (q.type === 'descriptive') return;
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
  if (!['mcq', 'msq', 'nat', 'tf'].includes(q.type)) {
    const inSeries = await asSystem(async (db) => (await db.query(
      `select 1 from public.tests where id = $1 and owner_org_id = $2 and test_series_id is not null`, [testId, orgId])).rowCount);
    if (inSeries) throw badRequest('This test is in a practice test series, which supports multiple-choice, true/false and numeric questions only.');
  }
  const choice = q.type === 'mcq' || q.type === 'msq';
  let options = choice ? q.options!.map((text, i) => ({ id: optionIds[i], text })) : null;
  let correct = choice ? [...new Set(q.correct!)].sort().map((i) => optionIds[i]) : null;
  if (q.type === 'tf') {
    options = [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }];
    correct = [q.answerTrue ? 'a' : 'b'];
  }
  const coding = q.type === 'coding';
  const judgeConfig = coding ? { compare: q.compare } : q.type === 'fib' && q.caseSensitive ? { caseSensitive: true } : {};
  const created = await asUser(userId, async (db) => {
    const owns = (await db.query(`select 1 from public.tests where id = $1 and owner_org_id = $2`, [testId, orgId])).rowCount;
    if (!owns) throw notFound('Test not found in this college.');
    const question = (await db.query<{ id: string }>(
      `insert into public.testseries_questions
         (question_type, body, options, correct_options, nat_answer, nat_tolerance, marks, negative_marks,
          topic, difficulty, explanation, owner_org_id, visibility, starter_code, judge_config,
          tags, text_answers, rubric, max_words)
       values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, 'private', $13::jsonb, $14::jsonb,
               $15, $16::jsonb, $17, $18) returning id`,
      [q.type, q.body, options ? JSON.stringify(options) : null, correct ? JSON.stringify(correct) : null,
       q.type === 'nat' ? q.natAnswer ?? null : null, q.natTolerance ?? 0, q.marks,
       ['mcq', 'tf', 'fib'].includes(q.type) ? q.negativeMarks : 0,
       q.topic ?? null, q.difficulty ?? null, q.explanation ?? null, orgId,
       JSON.stringify(coding ? Object.fromEntries(Object.entries(q.starterCode!).filter(([, c]) => c?.trim())) : {}), JSON.stringify(judgeConfig),
       [...new Set(q.tags)], q.type === 'fib' ? JSON.stringify(q.acceptedAnswers) : null,
       q.type === 'descriptive' ? q.rubric ?? null : null, q.type === 'descriptive' ? q.maxWords ?? null : null]
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
      `insert into public.test_questions (test_id, question_id, sort_order, section_id)
       values ($1, $2, coalesce((select max(sort_order) + 1 from public.test_questions where test_id = $1), 0), $3)`,
      [testId, question.id, q.sectionId ?? null]
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

// ── Sections ─────────────────────────────────────────────────────────────────
// RLS (campus.can_author_test) limits these to staff of the college that owns the test.

const sectionBody = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  /** Deal this many of the section's questions to each student (a pool). */
  drawCount: z.number().int().min(1).max(500).nullable().optional(),
});

testsRouter.post('/:testId/sections', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const body = sectionBody.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  const created = await asUser(userId, async (db) => {
    const owns = (await db.query(`select 1 from public.tests where id = $1 and owner_org_id = $2`, [testId, orgId])).rowCount;
    if (!owns) throw notFound('Test not found in this college.');
    return (await db.query(
      `insert into public.test_sections (test_id, name, duration_seconds, draw_count, sort_order)
       values ($1, $2, $3, $4, coalesce((select max(sort_order) + 1 from public.test_sections where test_id = $1), 0))
       returning id, name`,
      [testId, body.name, body.durationMinutes ? body.durationMinutes * 60 : null, body.drawCount ?? null]
    )).rows[0];
  });
  res.status(201).json(created);
});

testsRouter.patch('/:testId/sections/:sectionId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const sectionId = uuid.parse(req.params.sectionId);
  const body = sectionBody.partial().parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  await asUser(userId, async (db) => {
    const { rowCount } = await db.query(
      `update public.test_sections s set
          name = coalesce($3, s.name),
          duration_seconds = case when $4::boolean then $5 else s.duration_seconds end,
          draw_count = case when $7::boolean then $8 else s.draw_count end
        from public.tests t
        where s.id = $1 and s.test_id = $2 and t.id = s.test_id and t.owner_org_id = $6`,
      [sectionId, testId, body.name ?? null, body.durationMinutes !== undefined,
       body.durationMinutes ? body.durationMinutes * 60 : null, orgId, body.drawCount !== undefined, body.drawCount ?? null]
    );
    if (!rowCount) throw notFound('Section not found in this test.');
  });
  res.json({ ok: true });
});

/** Deleting a section keeps its questions; they become unsectioned. */
testsRouter.delete('/:testId/sections/:sectionId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const sectionId = uuid.parse(req.params.sectionId);
  await requirePermission(userId, orgId, 'content.create');
  await asUser(userId, async (db) => {
    const { rowCount } = await db.query(
      `delete from public.test_sections s using public.tests t
        where s.id = $1 and s.test_id = $2 and t.id = s.test_id and t.owner_org_id = $3`, [sectionId, testId, orgId]);
    if (!rowCount) throw notFound('Section not found in this test.');
  });
  res.status(204).end();
});

/** Move a question into a section (or out of all sections with null). */
testsRouter.patch('/:testId/questions/:questionId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const questionId = uuid.parse(req.params.questionId);
  const { sectionId } = z.object({ sectionId: z.string().uuid().nullable() }).parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  await asUser(userId, async (db) => {
    const { rowCount } = await db.query(
      `update public.test_questions set section_id = $3 where test_id = $1 and question_id = $2`, [testId, questionId, sectionId]);
    if (!rowCount) throw notFound('Question not found in this test.');
  });
  res.json({ ok: true });
});

// ── Question import (CSV; the portal converts Excel to CSV first) ────────────
const importBody = z.object({ csv: z.string().min(1).max(5_000_000) });

const summarize = (questions: SheetQuestion[]) => ({
  valid: questions.length,
  byType: Object.fromEntries(['mcq', 'msq', 'nat', 'tf', 'fib', 'descriptive'].map((t) => [t, questions.filter((q) => q.type === t).length])),
  sections: [...new Set(questions.map((q) => q.section).filter(Boolean))] as string[],
});

/** Check a sheet without writing anything. */
testsRouter.post('/:testId/questions/import/preview', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const { csv } = importBody.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  const owns = await asUser(userId, async (db) => (await db.query(`select 1 from public.tests where id = $1 and owner_org_id = $2`, [testId, orgId])).rowCount);
  if (!owns) throw notFound('Test not found in this college.');
  const { questions, errors } = parseQuestionSheet(csv);
  res.json({
    summary: { ...summarize(questions), invalid: errors.length },
    errors,
    sample: questions.slice(0, 5).map((q) => ({
      line: q.line, type: q.type, body: q.body, options: q.options, correct: q.correct, natAnswer: q.natAnswer, marks: q.marks,
      section: q.section, acceptedAnswers: q.textAnswers, tags: q.tags,
    })),
  });
});

/**
 * Add every question in the sheet to the test, all or nothing: any bad line
 * refuses the whole file. Sections named in the sheet are created if missing.
 */
testsRouter.post('/:testId/questions/import', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const { csv } = importBody.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  const { questions, errors } = parseQuestionSheet(csv);
  if (errors.length) throw badRequest(`Fix ${errors.length} ${errors.length === 1 ? 'line' : 'lines'} first — nothing was imported.`, errors);
  if (questions.length === 0) throw badRequest('The sheet has no questions.');

  const optionIds = 'abcdefghij'.split('');
  const result = await asUser(userId, async (db) => {
    const owns = (await db.query(`select 1 from public.tests where id = $1 and owner_org_id = $2`, [testId, orgId])).rowCount;
    if (!owns) throw notFound('Test not found in this college.');
    const sections = new Map((await db.query<{ id: string; name: string }>(
      `select id, name from public.test_sections where test_id = $1`, [testId])).rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
    let created = 0;
    for (const name of new Set(questions.map((q) => q.section).filter((x): x is string => Boolean(x)))) {
      if (sections.has(name.toLowerCase())) continue;
      const row = (await db.query<{ id: string }>(
        `insert into public.test_sections (test_id, name, sort_order)
         values ($1, $2, coalesce((select max(sort_order) + 1 from public.test_sections where test_id = $1), 0)) returning id`,
        [testId, name])).rows[0];
      sections.set(name.toLowerCase(), row.id);
      created++;
    }
    let order = (await db.query<{ n: number }>(`select coalesce(max(sort_order) + 1, 0)::int as n from public.test_questions where test_id = $1`, [testId])).rows[0].n;
    for (const q of questions) {
      const choice = q.options.length > 0;
      const options = choice ? q.options.map((text, i) => ({ id: optionIds[i], text })) : null;
      const correct = choice ? q.correct.map((i) => optionIds[i]) : null;
      const inserted = (await db.query<{ id: string }>(
        `insert into public.testseries_questions
           (question_type, body, options, correct_options, nat_answer, nat_tolerance, marks, negative_marks,
            topic, difficulty, explanation, owner_org_id, visibility, tags, text_answers, rubric)
         values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, 'private', $13, $14::jsonb, $15) returning id`,
        [q.type, q.body, options ? JSON.stringify(options) : null, correct ? JSON.stringify(correct) : null,
         q.natAnswer, q.natTolerance, q.marks, q.negativeMarks, q.topic, q.difficulty, q.explanation, orgId,
         q.tags, q.type === 'fib' ? JSON.stringify(q.textAnswers) : null, q.rubric])).rows[0];
      await db.query(
        `insert into public.test_questions (test_id, question_id, sort_order, section_id) values ($1, $2, $3, $4)`,
        [testId, inserted.id, order++, q.section ? sections.get(q.section.toLowerCase()) ?? null : null]);
    }
    return { imported: questions.length, sectionsCreated: created };
  });
  res.status(201).json(result);
});

// ── Sharing a test with another college ─────────────────────────────────────
testsRouter.get('/:testId/shares', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  await requirePermission(userId, orgId, 'content.create');
  const shares = await asUser(userId, async (db) => (await db.query<{ org_id: string; created_at: string }>(
    `select org_id, created_at from campus.test_shares where test_id = $1 and owner_org_id = $2`, [testId, orgId])).rows);
  // Other colleges' rows are hidden by RLS; their names are read by the ids just proven.
  const orgs = shares.length === 0 ? [] : await asSystem(async (db) => (await db.query<{ id: string; name: string; slug: string }>(
    `select id, name, slug from campus.organizations where id = any($1::uuid[])`, [shares.map((x) => x.org_id)])).rows);
  res.json(shares.map((x) => {
    const o = orgs.find((y) => y.id === x.org_id);
    return { orgId: x.org_id, name: o?.name ?? null, slug: o?.slug ?? null, sharedAt: x.created_at };
  }).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')));
});

const shareBody = z.object({ slug: z.string().trim().toLowerCase().min(2).max(63) });

testsRouter.post('/:testId/shares', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  const { slug } = shareBody.parse(req.body);
  await requirePermission(userId, orgId, 'content.create');
  // Colleges aren't listed to each other; staff share by the other college's short name.
  const target = await asSystem(async (db) => (await db.query<{ id: string; name: string }>(
    `select id, name from campus.organizations where slug = $1 and type = 'college' and status = 'active'`, [slug])).rows[0]);
  if (!target) throw notFound(`No college with the short name "${slug}".`);
  if (target.id === orgId) throw badRequest('That is your own college.');
  await asUser(userId, (db) => db.query(
    `insert into campus.test_shares (test_id, owner_org_id, org_id, created_by) values ($1, $2, $3, $4)`, [testId, orgId, target.id, userId]));
  res.status(201).json({ orgId: target.id, name: target.name });
});

testsRouter.delete('/:testId/shares/:targetOrgId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'content.create');
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.test_shares where test_id = $1 and owner_org_id = $2 and org_id = $3`,
    [uuid.parse(req.params.testId), orgId, uuid.parse(req.params.targetOrgId)])).rowCount);
  if (!n) throw notFound('That share does not exist.');
  res.status(204).end();
});

/**
 * Copy a test shared with this college into its own bank (questions, sections,
 * coding tests), so it can be edited. The copy is a draft owned by this college.
 */
testsRouter.post('/:testId/copy', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const testId = uuid.parse(req.params.testId);
  await requirePermission(userId, orgId, 'content.create');
  // Access: the share row must be visible to this college (RLS) — Forge tests can't be copied.
  const shared = await asUser(userId, async (db) => (await db.query(
    `select 1 from campus.test_shares where test_id = $1 and org_id = $2`, [testId, orgId])).rowCount);
  if (!shared) throw notFound('Only tests another college shared with you can be copied.');
  const copy = await asSystem(async (db) => {
    const t = (await db.query(`select * from public.tests where id = $1 and deleted_at is null`, [testId])).rows[0];
    if (!t) throw notFound('Test not found.');
    const slug = `${String(t.slug).slice(0, 60)}-${randomBytes(4).toString('hex')}`;
    const nt = (await db.query<{ id: string; title: string }>(
      `insert into public.tests (slug, title, instructions, duration_seconds, owner_org_id, visibility, is_published, section_time_locked, draw_count)
       values ($1, $2, $3, $4, $5, 'org', false, $6, $7) returning id, title`,
      [slug, `${t.title} (copy)`, t.instructions, t.duration_seconds, orgId, t.section_time_locked, t.draw_count])).rows[0];
    const sectionMap = new Map<string, string>();
    for (const sec of (await db.query(`select * from public.test_sections where test_id = $1 order by sort_order`, [testId])).rows) {
      const ns = (await db.query<{ id: string }>(
        `insert into public.test_sections (test_id, name, sort_order, duration_seconds, draw_count) values ($1, $2, $3, $4, $5) returning id`,
        [nt.id, sec.name, sec.sort_order, sec.duration_seconds, sec.draw_count])).rows[0];
      sectionMap.set(sec.id, ns.id);
    }
    const links = (await db.query(
      `select tq.sort_order, tq.section_id, q.* from public.test_questions tq join public.testseries_questions q on q.id = tq.question_id
        where tq.test_id = $1 order by tq.sort_order`, [testId])).rows;
    for (const q of links) {
      const nq = (await db.query<{ id: string }>(
        `insert into public.testseries_questions
           (question_type, body, options, correct_options, nat_answer, nat_tolerance, marks, negative_marks, topic, difficulty,
            explanation, owner_org_id, visibility, starter_code, judge_config, tags, text_answers, rubric, max_words)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'private', $13, $14, $15, $16, $17, $18) returning id`,
        [q.question_type, q.body, q.options ? JSON.stringify(q.options) : null, q.correct_options ? JSON.stringify(q.correct_options) : null,
         q.nat_answer, q.nat_tolerance, q.marks, q.negative_marks, q.topic, q.difficulty, q.explanation, orgId,
         JSON.stringify(q.starter_code ?? {}), JSON.stringify(q.judge_config ?? {}), q.tags ?? [],
         q.text_answers ? JSON.stringify(q.text_answers) : null, q.rubric, q.max_words])).rows[0];
      await db.query(
        `insert into public.question_test_cases (question_id, input, expected_output, is_sample, sort_order)
         select $2, input, expected_output, is_sample, sort_order from public.question_test_cases where question_id = $1`, [q.id, nq.id]);
      await db.query(`insert into public.test_questions (test_id, question_id, sort_order, section_id) values ($1, $2, $3, $4)`,
        [nt.id, nq.id, q.sort_order, q.section_id ? sectionMap.get(q.section_id) ?? null : null]);
    }
    return nt;
  });
  res.status(201).json(copy);
});
