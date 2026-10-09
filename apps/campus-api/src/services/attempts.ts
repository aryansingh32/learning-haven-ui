// Proctored assignment attempts.
//
// Every entry point first reads the assignment/attempt AS THE STUDENT, so
// RLS decides whether they may act at all (batch membership, published,
// own attempt). Only then do we use system access, by explicit id, for what
// RLS hides from learners: questions with answers and attempt writes.
// Scoring always uses server-saved answers, never a client payload.

import { randomUUID } from 'crypto';
import {
  AnswerState,
  buildAttemptOrder,
  classifyEvent,
  countsAsLeave,
  normalizePolicy,
  ProctoringEventType,
  ProctoringPolicy,
  scoreAttempt,
  ScoringQuestion,
  sectionClock,
  finishSection,
  drawFromPools,
  shouldAutoSubmit,
} from '@repo/assessment-core';
import { asSystem, asUser, Db } from '../db';
import { badRequest, HttpError, notFound } from '../errors';
import { JudgedLanguage, judgeCode, JudgeUnavailableError, languagesOf, StarterCode } from './judge';

interface QuestionRow {
  id: string;
  question_group_id: string | null;
  question_type: 'mcq' | 'msq' | 'nat' | 'coding' | 'tf' | 'fib' | 'descriptive';
  body: string;
  options: Array<{ id: string; text: string }> | null;
  correct_options: string[] | null;
  nat_answer: string | null;
  nat_tolerance: string;
  marks: string;
  negative_marks: string;
  section_id: string | null;
  section_name: string | null;
  stimulus: string | null;
  starter_code: StarterCode;
  judge_config: { compare?: string; caseSensitive?: boolean };
  text_answers: string[] | null;
  max_words: number | null;
}

const TEXT_TYPES = new Set(['fib', 'descriptive']);
const MAX_TEXT_ANSWER = 20_000;
const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

interface TestCaseRow {
  question_id: string;
  input: string;
  expected_output: string;
  is_sample: boolean;
}

interface AttemptRow {
  id: string;
  user_id: string;
  test_id: string;
  assignment_id: string;
  org_id: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  answers: AnswerState[];
  score: string | null;
  correct_count: number | null;
  total_questions: number;
  total_marks: string;
  attempt_number: number;
  question_order: { questionIds: string[]; optionOrder: Record<string, string[]>; sections?: SnapshotSection[]; version?: string } | null;
  current_section: number;
  section_started_at: string | null;
  last_seen_at: string | null;
  violation_count: number;
  submit_reason: string | null;
  feedback: string | null;
}

/** A timed section as dealt to this attempt (snapshot at start). */
interface SnapshotSection {
  id: string;
  name: string;
  durationSeconds: number;
  questionIds: string[];
}

interface AssignmentRow {
  id: string;
  org_id: string;
  test_id: string;
  title: string;
  instructions: string | null;
  opens_at: string;
  closes_at: string;
  duration_seconds: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  result_release: 'immediately' | 'after_close' | 'manual';
  results_released_at: string | null;
  proctoring: Partial<ProctoringPolicy>;
  paper_versions: number;
}

const toScoring = (q: QuestionRow): ScoringQuestion => ({
  id: q.id,
  question_type: q.question_type,
  correct_options: q.correct_options,
  nat_answer: q.nat_answer !== null ? Number(q.nat_answer) : null,
  nat_tolerance: Number(q.nat_tolerance ?? 0),
  marks: Number(q.marks),
  negative_marks: Number(q.negative_marks ?? 0),
  text_answers: q.text_answers,
  case_sensitive: q.judge_config?.caseSensitive === true,
});

export function resultsReleased(a: Pick<AssignmentRow, 'result_release' | 'closes_at' | 'results_released_at'>, now = new Date()) {
  if (a.result_release === 'immediately') return true;
  if (a.result_release === 'after_close') return now > new Date(a.closes_at);
  return a.results_released_at !== null;
}

async function loadQuestions(db: Db, testId: string): Promise<QuestionRow[]> {
  const { rows } = await db.query<QuestionRow>(
    `select q.id, q.question_group_id, q.question_type, q.body, q.options, q.correct_options,
            q.nat_answer, q.nat_tolerance, q.marks, q.negative_marks, q.starter_code, q.judge_config,
            q.text_answers, q.max_words, tq.section_id, s.name as section_name, g.stimulus
       from public.test_questions tq
       join public.testseries_questions q on q.id = tq.question_id
       left join public.test_sections s on s.id = tq.section_id
       left join public.question_groups g on g.id = q.question_group_id
      where tq.test_id = $1
      order by s.sort_order nulls first, tq.sort_order, q.id`,
    [testId]
  );
  return rows;
}

/** Test cases for coding questions — samples only unless `all`. Server side only. */
async function loadTestCases(db: Db, questionIds: string[], all: boolean): Promise<Map<string, TestCaseRow[]>> {
  const byQuestion = new Map<string, TestCaseRow[]>();
  if (questionIds.length === 0) return byQuestion;
  const { rows } = await db.query<TestCaseRow>(
    `select question_id, input, expected_output, is_sample from public.question_test_cases
      where question_id = any($1::uuid[]) and ($2 or is_sample)
      order by question_id, sort_order, created_at`,
    [questionIds, all]
  );
  for (const r of rows) byQuestion.set(r.question_id, [...(byQuestion.get(r.question_id) ?? []), r]);
  return byQuestion;
}

const toJudgeTests = (rows: TestCaseRow[]) => rows.map((t) => ({ input: t.input, expected: t.expected_output, isSample: t.is_sample }));

/** The student's view of the assignment — null when RLS says they can't see it. */
async function visibleAssignment(userId: string, assignmentId: string): Promise<AssignmentRow | null> {
  return asUser(userId, async (db) => {
    const { rows } = await db.query<AssignmentRow>(
      `select id, org_id, test_id, title, instructions, opens_at, closes_at, duration_seconds, max_attempts,
              shuffle_questions, shuffle_options, result_release, results_released_at, proctoring, paper_versions
         from campus.assignments
        where id = $1 and status = 'published' and campus.is_assignment_target(id)`,
      [assignmentId]
    );
    return rows[0] ?? null;
  });
}

/** The student's own attempt — RLS returns nothing for anyone else's. */
async function ownAttempt(userId: string, attemptId: string): Promise<AttemptRow> {
  const attempt = await asUser(userId, async (db) => {
    const { rows } = await db.query<AttemptRow>(
      `select * from public.test_attempts where id = $1 and user_id = $2 and assignment_id is not null`,
      [attemptId, userId]
    );
    return rows[0];
  });
  if (!attempt) throw notFound('Attempt not found.');
  return attempt;
}

async function assignmentFor(attempt: AttemptRow): Promise<AssignmentRow> {
  return asSystem(async (db) => {
    const { rows } = await db.query<AssignmentRow>(`select * from campus.assignments where id = $1`, [attempt.assignment_id]);
    return rows[0];
  });
}

/**
 * The questions this attempt was dealt at start. If staff edit the test while
 * students are sitting it, an attempt is still scored on its own question set.
 */
function attemptQuestions(attempt: AttemptRow, questions: QuestionRow[]): QuestionRow[] {
  const dealt = attempt.question_order?.questionIds;
  if (!dealt) return questions;
  const ids = new Set(dealt);
  return questions.filter((q) => ids.has(q.id));
}

const codingIds = (questions: QuestionRow[]) => new Set(questions.filter((q) => q.question_type === 'coding').map((q) => q.id));

function rescore(questions: QuestionRow[], answers: AnswerState[]) {
  return scoreAttempt(questions.map(toScoring), answers);
}

/**
 * Close the attempt and score it from the answers saved in the database.
 * Closing comes first, so no answer can change while code is judged; coding
 * answers count as "grading pending" (0 marks) until the judge has run.
 * Idempotent under races: only the request that closes the attempt grades it.
 */
async function finalize(attempt: AttemptRow, reason: 'manual' | 'timeout' | 'violations' | 'closed' | 'invigilator'): Promise<AttemptRow> {
  const closed = await asSystem(async (db) => {
    const questions = attemptQuestions(attempt, await loadQuestions(db, attempt.test_id));
    const { rows } = await db.query<AttemptRow>(
      `update public.test_attempts
          set status = 'completed', submitted_at = least(now(), expires_at), submit_reason = $2
        where id = $1 and status = 'in_progress'
        returning *`,
      [attempt.id, reason]
    );
    if (!rows[0]) {
      const fresh = await db.query<AttemptRow>(`select * from public.test_attempts where id = $1`, [attempt.id]);
      return { row: fresh.rows[0], closedNow: false, needsJudge: false };
    }
    const coding = codingIds(questions);
    const written = new Set(questions.filter((q) => q.question_type === 'descriptive').map((q) => q.id));
    let needsJudge = false;
    const answers = (rows[0].answers ?? []).map((a) => {
      // Written answers wait for an evaluator.
      if (written.has(a.question_id) && a.text_value?.trim()) return { ...a, grading: 'pending' as const };
      if (!coding.has(a.question_id) || !a.code?.trim()) return a;
      needsJudge = true;
      return { ...a, grading: 'pending' as const, tests_passed: null, tests_total: null };
    });
    const { totalScore, correctCount, totalMarks } = rescore(questions, answers);
    const updated = await db.query<AttemptRow>(
      `update public.test_attempts set answers = $2::jsonb, score = $3, correct_count = $4, total_marks = $5
        where id = $1 returning *`,
      [attempt.id, JSON.stringify(answers), totalScore, correctCount, totalMarks]
    );
    return { row: updated.rows[0], closedNow: true, needsJudge };
  });
  if (!closed.closedNow || !closed.needsJudge) return closed.row;
  try {
    await gradeCodingAnswers(attempt.id);
  } catch (err) {
    // The attempt is safely closed with coding marks pending; staff can regrade.
    console.error('Grading coding answers failed', { attemptId: attempt.id, error: err instanceof Error ? err.message : String(err) });
  }
  return asSystem(async (db) => (await db.query<AttemptRow>(`select * from public.test_attempts where id = $1`, [attempt.id])).rows[0]);
}

/**
 * Judge the coding answers of a submitted attempt against every test (sample
 * and hidden) and rescore it. Answers already judged are kept unless `rejudge`.
 * If the judge is unavailable, those answers stay pending.
 * Callers must already have proven access to the attempt.
 */
export async function gradeCodingAnswers(attemptId: string, rejudge = false): Promise<{ judged: number; pending: number }> {
  const loaded = await asSystem(async (db) => {
    const attempt = (await db.query<AttemptRow>(`select * from public.test_attempts where id = $1 and status = 'completed'`, [attemptId])).rows[0];
    if (!attempt) return null;
    const questions = attemptQuestions(attempt, await loadQuestions(db, attempt.test_id));
    const tests = await loadTestCases(db, [...codingIds(questions)], true);
    return { attempt, questions, tests };
  });
  if (!loaded) return { judged: 0, pending: 0 };
  const { attempt, questions, tests } = loaded;
  const byId = new Map(questions.map((q) => [q.id, q]));

  let judged = 0;
  let pending = 0;
  let judgeDown = false;
  const answers: AnswerState[] = [];
  for (const a of attempt.answers ?? []) {
    const q = byId.get(a.question_id);
    if (!q || q.question_type !== 'coding' || !a.code?.trim() || (a.grading === 'judged' && !rejudge)) {
      answers.push(a);
      continue;
    }
    const cases = toJudgeTests(tests.get(q.id) ?? []);
    const language = a.language as JudgedLanguage;
    if (!languagesOf(q.starter_code).includes(language)) {
      answers.push({ ...a, grading: 'judged', tests_passed: 0, tests_total: cases.length });
      judged++;
      continue;
    }
    if (judgeDown) {
      answers.push({ ...a, grading: 'pending' });
      pending++;
      continue;
    }
    try {
      const r = await judgeCode({ starterCode: q.starter_code, judgeConfig: q.judge_config }, a.code, language, cases);
      answers.push({ ...a, grading: 'judged', tests_passed: r.passed, tests_total: r.total });
      judged++;
    } catch (err) {
      if (!(err instanceof JudgeUnavailableError)) throw err;
      judgeDown = true;
      answers.push({ ...a, grading: 'pending' });
      pending++;
    }
  }

  const { totalScore, correctCount, totalMarks } = rescore(questions, answers);
  await asSystem((db) => db.query(
    `update public.test_attempts set answers = $2::jsonb, score = $3, correct_count = $4, total_marks = $5
      where id = $1 and status = 'completed'`,
    [attemptId, JSON.stringify(answers), totalScore, correctCount, totalMarks]
  ));
  return { judged, pending };
}

/** Where a timed-section attempt is now (null for tests without timed sections). */
function clockOf(attempt: AttemptRow, now = new Date()) {
  const sections = attempt.question_order?.sections;
  if (!sections?.length) return null;
  return sectionClock(
    sections,
    { index: attempt.current_section, startedAt: new Date(attempt.section_started_at ?? attempt.started_at) },
    new Date(attempt.expires_at),
    now
  );
}

/** Persist a section move. Only one request wins a race; the others re-read. */
async function moveToSection(attempt: AttemptRow, index: number, startedAt: Date): Promise<AttemptRow> {
  return asSystem(async (db) => {
    const { rows } = await db.query<AttemptRow>(
      `update public.test_attempts set current_section = $2, section_started_at = $3
        where id = $1 and status = 'in_progress' and current_section = $4
        returning *`,
      [attempt.id, index, startedAt.toISOString(), attempt.current_section]
    );
    return rows[0] ?? (await db.query<AttemptRow>(`select * from public.test_attempts where id = $1`, [attempt.id])).rows[0];
  });
}

/** Submit attempts whose time is up, and move timed sections on when their clock runs out. */
/** Snapshot the test's timed sections in authored order, each with this attempt's question order. */
async function timedSectionsFor(db: Db, testId: string, questions: QuestionRow[], dealt: string[]): Promise<SnapshotSection[]> {
  const { rows } = await db.query<{ id: string; name: string; duration_seconds: number | null }>(
    `select id, name, duration_seconds from public.test_sections where test_id = $1 order by sort_order, created_at`, [testId]);
  const sectionOf = new Map(questions.map((q) => [q.id, q.section_id]));
  const sections = rows
    .map((s) => ({ id: s.id, name: s.name, durationSeconds: s.duration_seconds ?? 0, questionIds: dealt.filter((id) => sectionOf.get(id) === s.id) }))
    .filter((s) => s.questionIds.length > 0);
  const placed = sections.reduce((n, s) => n + s.questionIds.length, 0);
  if (sections.length === 0 || placed !== dealt.length || sections.some((s) => s.durationSeconds <= 0)) {
    throw badRequest("This test's timed sections aren't set up completely yet. Ask your faculty.");
  }
  return sections;
}

async function closeIfExpired(attempt: AttemptRow): Promise<AttemptRow> {
  if (attempt.status !== 'in_progress') return attempt;
  if (new Date(attempt.expires_at) <= new Date()) return finalize(attempt, 'timeout');
  const clock = clockOf(attempt);
  if (!clock) return attempt;
  if (clock.finished) return finalize(attempt, 'timeout');
  if (clock.index !== attempt.current_section) return moveToSection(attempt, clock.index, clock.startedAt);
  return attempt;
}

/** In a timed-section test, only the current section can be answered. */
function assertInCurrentSection(attempt: AttemptRow, questionId: string) {
  const clock = clockOf(attempt);
  if (!clock) return;
  const current = attempt.question_order!.sections![clock.index];
  // 423 (not 409): the attempt is still open, the student just moves on to the next section.
  if (!current.questionIds.includes(questionId)) throw new HttpError(423, 'That section has closed — its answers can no longer be changed.');
}

export async function startAttempt(userId: string, assignmentId: string) {
  const assignment = await visibleAssignment(userId, assignmentId);
  if (!assignment) throw notFound('Assignment not found.');

  const now = new Date();
  if (now < new Date(assignment.opens_at)) throw badRequest('This test has not opened yet.');
  if (now >= new Date(assignment.closes_at)) throw badRequest('This test has closed.');

  const mine = await asUser(userId, async (db) => {
    const { rows } = await db.query<AttemptRow>(
      `select * from public.test_attempts where assignment_id = $1 and user_id = $2 order by attempt_number desc`,
      [assignmentId, userId]
    );
    return rows;
  });

  const open = mine.find((a) => a.status === 'in_progress');
  if (open) {
    const current = await closeIfExpired(open);
    if (current.status === 'in_progress') return getAttemptView(userId, current.id);
  }

  const used = mine.length;
  if (used >= assignment.max_attempts) {
    throw new HttpError(409, assignment.max_attempts === 1 ? 'You have already taken this test.' : 'You have used all your attempts.');
  }

  const attemptId = randomUUID();
  await asSystem(async (db) => {
    // Paper versions: students are dealt A, B, C… in roll-number order, and
    // everyone on one version gets the same questions in the same order.
    let version: number | null = null;
    if (assignment.paper_versions > 1) {
      const { rows } = await db.query<{ user_id: string }>(
        `select user_id from campus.assignment_students($1) order by roll_number nulls last, user_id`, [assignment.id]);
      const i = rows.findIndex((r) => r.user_id === userId);
      version = (i < 0 ? 0 : i) % assignment.paper_versions;
    }
    const seed = version === null ? attemptId : `${assignment.id}:paper:${version}`;
    const test = await db.query<{ duration_seconds: number; section_time_locked: boolean; draw_count: number | null }>(
      `select duration_seconds, section_time_locked, draw_count from public.tests where id = $1`, [assignment.test_id]);
    const allQuestions = await loadQuestions(db, assignment.test_id);
    if (allQuestions.length === 0) throw badRequest('This test has no questions yet. Ask your faculty.');

    // Pools: deal N of M per section (seeded by this attempt), before ordering.
    const pools = await db.query<{ id: string; draw_count: number }>(
      `select id, draw_count from public.test_sections where test_id = $1 and draw_count is not null`, [assignment.test_id]);
    const drawCounts = new Map<string, number>(pools.rows.map((r) => [r.id, r.draw_count]));
    if (test.rows[0].draw_count) drawCounts.set('', test.rows[0].draw_count);
    const questions = drawFromPools(allQuestions, drawCounts, seed);

    // Accommodation: extra time for this student, on the test and on each timed section.
    const accommodation = await db.query<{ extra_percent: number }>(
      `select extra_percent from campus.assignment_accommodations where assignment_id = $1 and user_id = $2`, [assignment.id, userId]);
    const extraPercent = accommodation.rows[0]?.extra_percent ?? 0;
    const stretch = (seconds: number) => Math.ceil(seconds * (1 + extraPercent / 100));

    let duration = assignment.duration_seconds ?? test.rows[0].duration_seconds;
    const order: AttemptRow['question_order'] & object = buildAttemptOrder(
      questions,
      { shuffleQuestions: assignment.shuffle_questions, shuffleOptions: assignment.shuffle_options },
      seed
    );
    if (version !== null) order.version = String.fromCharCode(65 + version);
    if (test.rows[0].section_time_locked) {
      order.sections = (await timedSectionsFor(db, assignment.test_id, questions, order.questionIds))
        .map((x) => ({ ...x, durationSeconds: stretch(x.durationSeconds) }));
      // A timed-section test lasts exactly as long as its sections.
      duration = order.sections.reduce((sum, x) => sum + x.durationSeconds, 0);
    } else {
      duration = stretch(duration);
    }
    // Extra time may run past the closing time by the same proportion.
    const closesBy = new Date(new Date(assignment.closes_at).getTime() + Math.ceil(duration * extraPercent / (100 + extraPercent)) * 1000);
    const initialAnswers: AnswerState[] = order.questionIds.map((id) => ({
      question_id: id, status: 'not_visited', selected_options: null, nat_value: null,
    }));
    const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);

    try {
      await db.query(
        `insert into public.test_attempts
           (id, user_id, test_id, assignment_id, org_id, attempt_number, status, started_at,
            expires_at, answers, total_questions, total_marks, question_order, current_section, section_started_at)
         values ($1, $2, $3, $4, $5, $6, 'in_progress', now(),
                 least(now() + make_interval(secs => $7::int), $8::timestamptz), $9::jsonb, $10, $11, $12::jsonb, 0, now())`,
        [attemptId, userId, assignment.test_id, assignment.id, assignment.org_id, used + 1,
         duration, closesBy.toISOString(), JSON.stringify(initialAnswers), questions.length, totalMarks, JSON.stringify(order)]
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        // A parallel request started it first, or a practice attempt of the same test is open.
        throw new HttpError(409, 'This test is already open in another tab. Close it there or finish it first.');
      }
      throw err;
    }
  });

  return getAttemptView(userId, attemptId);
}

/** Progress of an attempt for staff views (answered count, current timed section). */
export function attemptProgress(attempt: AttemptRow) {
  const answered = (attempt.answers ?? []).filter((x) => x.status === 'answered' || x.status === 'answered_marked').length;
  const clock = attempt.status === 'in_progress' ? clockOf(attempt) : null;
  const section = clock ? attempt.question_order!.sections![clock.index] : null;
  return {
    answered,
    total: attempt.total_questions,
    section: clock && section ? { index: clock.index, count: attempt.question_order!.sections!.length, name: section.name, endsAt: clock.endsAt.toISOString() } : null,
  };
}

export type { AttemptRow };

/** The student is still here: the live board shows who has dropped off. */
async function touch(attemptId: string) {
  await asSystem((db) => db.query(`update public.test_attempts set last_seen_at = now() where id = $1 and status = 'in_progress'`, [attemptId]));
}

export async function heartbeat(userId: string, attemptId: string) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status === 'in_progress') await touch(attemptId);
  return { status: attempt.status, expiresAt: attempt.expires_at };
}

/**
 * Give one student extra time (e.g. after a power cut). Also extends the
 * current timed section, so the minutes land where the student is.
 * Callers must already have proven the invigilator may act on this attempt.
 */
export async function extendAttempt(attemptId: string, minutes: number) {
  return asSystem(async (db) => {
    const { rows } = await db.query<AttemptRow>(
      `update public.test_attempts
          set expires_at = expires_at + make_interval(mins => $2),
              section_started_at = case when question_order ? 'sections' then section_started_at + make_interval(mins => $2) else section_started_at end
        where id = $1 and status = 'in_progress' and expires_at > now()
        returning *`,
      [attemptId, minutes]
    );
    if (!rows[0]) throw new HttpError(409, 'This attempt has already ended.');
    return rows[0];
  });
}

/** End an attempt now (e.g. malpractice). Scored on what was saved. */
export async function forceSubmitAttempt(attemptId: string) {
  const attempt = await asSystem(async (db) => (await db.query<AttemptRow>(`select * from public.test_attempts where id = $1`, [attemptId])).rows[0]);
  if (!attempt || attempt.status !== 'in_progress') throw new HttpError(409, 'This attempt has already ended.');
  return finalize(attempt, 'invigilator');
}

export async function getAttemptView(userId: string, attemptId: string) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status === 'in_progress') await touch(attemptId);
  const assignment = await assignmentFor(attempt);
  const policy = normalizePolicy(assignment.proctoring);
  const released = resultsReleased(assignment);

  const questions = attempt.status === 'in_progress' || released
    ? attemptQuestions(attempt, await asSystem((db) => loadQuestions(db, attempt.test_id)))
    : [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  const order = attempt.question_order ?? { questionIds: questions.map((q) => q.id), optionOrder: {} };

  const samples = attempt.status === 'in_progress'
    ? await asSystem((db) => loadTestCases(db, [...codingIds(questions)], false))
    : new Map<string, TestCaseRow[]>();

  // Timed sections: only the current section's questions are sent.
  const clock = attempt.status === 'in_progress' ? clockOf(attempt) : null;
  const visible = clock ? new Set(order.sections![clock.index].questionIds) : null;

  const publicQuestions = attempt.status === 'in_progress'
    ? order.questionIds.filter((id) => byId.has(id) && (!visible || visible.has(id))).map((id) => {
        const q = byId.get(id)!;
        const optionIds = order.optionOrder[id];
        const options = q.options && optionIds
          ? optionIds.map((oid) => q.options!.find((o) => o.id === oid)!).filter(Boolean)
          : q.options;
        // Correct answers never leave the server while the attempt is open.
        return {
          id: q.id, type: q.question_type, body: q.body, options,
          marks: Number(q.marks), negativeMarks: Number(q.negative_marks ?? 0),
          section: q.section_name, passage: q.stimulus,
          ...(q.question_type === 'descriptive' && q.max_words ? { maxWords: q.max_words } : {}),
          // Coding: starter code and sample tests only — hidden tests stay on the server.
          ...(q.question_type === 'coding' ? {
            languages: languagesOf(q.starter_code),
            starterCode: q.starter_code,
            samples: (samples.get(q.id) ?? []).map((t) => ({ input: t.input, expected: t.expected_output })),
          } : {}),
        };
      })
    : [];

  return {
    attemptId: attempt.id,
    assignment: { id: assignment.id, title: assignment.title, instructions: assignment.instructions, closesAt: assignment.closes_at },
    status: attempt.status,
    attemptNumber: attempt.attempt_number,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    serverNow: new Date().toISOString(),
    proctoring: policy,
    violationCount: attempt.violation_count,
    questions: publicQuestions,
    answers: attempt.status === 'in_progress' ? (attempt.answers ?? []).filter((a) => !visible || visible.has(a.question_id)) : undefined,
    sections: order.sections?.map((x) => ({ id: x.id, name: x.name, durationSeconds: x.durationSeconds, questionCount: x.questionIds.length })) ?? null,
    currentSection: clock ? { index: clock.index, endsAt: clock.endsAt.toISOString() } : null,
    submitReason: attempt.submit_reason,
    paperVersion: order.version ?? null,
    result: attempt.status === 'completed' ? resultView(attempt, released, questions, order.questionIds) : undefined,
  };
}

function resultView(attempt: AttemptRow, released: boolean, questions: QuestionRow[], dealtOrder: string[]) {
  if (!released) return { released: false as const };
  // Report questions in the order this student saw them (shuffled per attempt).
  const position = new Map(dealtOrder.map((id, i) => [id, i]));
  const ordered = [...questions].sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity));
  const scored = scoreAttempt(ordered.map(toScoring), attempt.answers ?? []);
  return {
    released: true as const,
    score: Number(attempt.score),
    totalMarks: Number(attempt.total_marks),
    correctCount: attempt.correct_count,
    totalQuestions: attempt.total_questions,
    // Evaluators' comments, per question and on the whole attempt.
    perQuestion: scored.perQuestion.map((r) => {
      const a = (attempt.answers ?? []).find((x) => x.question_id === r.questionId);
      return a?.feedback ? { ...r, feedback: a.feedback } : r;
    }),
    feedback: attempt.feedback ?? null,
  };
}

export async function saveAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  payload: {
    selectedOptions?: string[] | null; natValue?: number | null; code?: string | null; language?: string | null;
    textValue?: string | null; markedForReview?: boolean;
  }
) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'Time is up — this attempt has been submitted.');
  assertInCurrentSection(attempt, questionId);

  const answers: AnswerState[] = attempt.answers ?? [];
  const idx = answers.findIndex((a) => a.question_id === questionId);
  if (idx < 0) throw badRequest('That question is not part of this test.');

  const question = await asSystem(async (db) => (await db.query<Pick<QuestionRow, 'options' | 'question_type' | 'starter_code' | 'max_words'>>(
    `select options, question_type, starter_code, max_words from public.testseries_questions where id = $1`, [questionId]
  )).rows[0]);
  if (!question) throw badRequest('That question is not part of this test.');

  if (question.question_type === 'coding') {
    if (payload.selectedOptions?.length || (payload.natValue !== undefined && payload.natValue !== null)) {
      throw badRequest('This is a coding question — save code, not an option.');
    }
    const previous = answers[idx];
    const code = payload.code !== undefined ? payload.code : previous.code ?? null;
    const language = payload.language !== undefined ? payload.language : previous.language ?? null;
    if (code && (!language || !languagesOf(question.starter_code).includes(language as JudgedLanguage))) {
      throw badRequest('Pick one of the languages this question allows.');
    }
    const hasCode = Boolean(code?.trim());
    answers[idx] = {
      question_id: questionId,
      status: hasCode ? (payload.markedForReview ? 'answered_marked' : 'answered') : (payload.markedForReview ? 'marked_for_review' : 'visited'),
      selected_options: null,
      nat_value: null,
      code,
      language,
    };
  } else if (TEXT_TYPES.has(question.question_type)) {
    if (payload.code || payload.selectedOptions?.length || (payload.natValue !== undefined && payload.natValue !== null)) {
      throw badRequest('Type your answer for this question.');
    }
    const previous = answers[idx];
    const text = payload.textValue !== undefined ? payload.textValue : previous.text_value ?? null;
    if (text && text.length > MAX_TEXT_ANSWER) throw badRequest('That answer is too long.');
    if (text && question.question_type === 'fib' && text.length > 500) throw badRequest('Keep this answer short — a word or a phrase.');
    if (text && question.max_words && wordCount(text) > question.max_words) {
      throw badRequest(`Keep your answer within ${question.max_words} words.`);
    }
    const hasText = Boolean(text?.trim());
    answers[idx] = {
      question_id: questionId,
      status: hasText ? (payload.markedForReview ? 'answered_marked' : 'answered') : (payload.markedForReview ? 'marked_for_review' : 'visited'),
      selected_options: null,
      nat_value: null,
      text_value: text,
    };
  } else {
    if (payload.code) throw badRequest('Only coding questions take code.');
    if (payload.textValue) throw badRequest('Pick an option for this question.');
    if (payload.selectedOptions?.length) {
      const ids = new Set((question.options ?? []).map((o) => o.id));
      const single = question.question_type === 'mcq' || question.question_type === 'tf';
      const valid = payload.selectedOptions.every((o) => ids.has(o)) && (!single || payload.selectedOptions.length === 1);
      if (!valid) throw badRequest('That answer is not one of the options.');
    }
    const hasAnswer = Boolean(payload.selectedOptions?.length) || (payload.natValue !== undefined && payload.natValue !== null);
    answers[idx] = {
      question_id: questionId,
      status: hasAnswer
        ? (payload.markedForReview ? 'answered_marked' : 'answered')
        : (payload.markedForReview ? 'marked_for_review' : 'visited'),
      selected_options: payload.selectedOptions?.length ? payload.selectedOptions : null,
      nat_value: payload.natValue ?? null,
    };
  }
  const status = answers[idx].status;

  const updated = await asSystem(async (db) => {
    const { rowCount } = await db.query(
      `update public.test_attempts set answers = $2::jsonb, last_seen_at = now()
        where id = $1 and status = 'in_progress' and expires_at > now()`,
      [attemptId, JSON.stringify(answers)]
    );
    return rowCount;
  });
  if (!updated) throw new HttpError(409, 'Time is up — this attempt has been submitted.');
  return { questionId, status };
}

// One sample run per attempt at a time, and not more often than this.
const RUN_INTERVAL_MS = 3_000;
const lastRun = new Map<string, number>();

/** Run code on a coding question's SAMPLE tests while the attempt is open. Never scores. */
export async function runSamples(userId: string, attemptId: string, questionId: string, payload: { code: string; language: string }) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'Time is up — this attempt has been submitted.');
  if (!(attempt.answers ?? []).some((a) => a.question_id === questionId)) throw badRequest('That question is not part of this test.');
  assertInCurrentSection(attempt, questionId);

  const now = Date.now();
  if (now - (lastRun.get(attemptId) ?? 0) < RUN_INTERVAL_MS) throw new HttpError(429, 'Wait a moment before running again.');
  lastRun.set(attemptId, now);
  if (lastRun.size > 10_000) for (const [k, t] of lastRun) if (now - t > 60_000) lastRun.delete(k);

  const { question, samples } = await asSystem(async (db) => {
    const q = (await db.query<Pick<QuestionRow, 'question_type' | 'starter_code' | 'judge_config'>>(
      `select question_type, starter_code, judge_config from public.testseries_questions where id = $1`, [questionId]
    )).rows[0];
    return { question: q, samples: (await loadTestCases(db, [questionId], false)).get(questionId) ?? [] };
  });
  if (!question || question.question_type !== 'coding') throw badRequest('Only coding questions can be run.');
  if (!languagesOf(question.starter_code).includes(payload.language as JudgedLanguage)) {
    throw badRequest('Pick one of the languages this question allows.');
  }
  if (samples.length === 0) throw badRequest('This question has no sample tests to run.');
  try {
    return await judgeCode({ starterCode: question.starter_code, judgeConfig: question.judge_config }, payload.code, payload.language as JudgedLanguage, toJudgeTests(samples));
  } catch (err) {
    if (err instanceof JudgeUnavailableError) throw new HttpError(503, 'Running code is not available right now. Your code is saved and will be graded after you submit.');
    throw err;
  }
}

export async function recordEvent(userId: string, attemptId: string, type: ProctoringEventType) {
  const attempt = await ownAttempt(userId, attemptId);
  if (attempt.status !== 'in_progress') return { severity: null, violationCount: attempt.violation_count, autoSubmitted: false };
  const assignment = await assignmentFor(attempt);
  const policy = normalizePolicy(assignment.proctoring);
  if (!policy.enabled) return { severity: null, violationCount: attempt.violation_count, autoSubmitted: false };

  const severity = await asUser(userId, async (db) => {
    const { rows } = await db.query<{ n: string }>(
      `select count(*) as n from campus.proctoring_events
        where attempt_id = $1 and event_type in ('tab_switch', 'window_blur', 'fullscreen_exit')`,
      [attemptId]
    );
    const sev = countsAsLeave(type) ? classifyEvent(type, Number(rows[0].n), policy) : classifyEvent(type, 0, policy);
    await db.query(
      `insert into campus.proctoring_events (org_id, attempt_id, user_id, event_type, severity) values ($1, $2, $3, $4, $5)`,
      [attempt.org_id, attemptId, userId, type, sev]
    );
    return sev;
  });

  let violationCount = attempt.violation_count;
  if (severity === 'violation') {
    violationCount = await asSystem(async (db) => {
      const { rows } = await db.query<{ violation_count: number }>(
        `update public.test_attempts set violation_count = violation_count + 1
          where id = $1 and status = 'in_progress' returning violation_count`,
        [attemptId]
      );
      return rows[0]?.violation_count ?? attempt.violation_count;
    });
  }

  let autoSubmitted = false;
  if (shouldAutoSubmit(violationCount, policy)) {
    await finalize({ ...attempt, violation_count: violationCount }, 'violations');
    autoSubmitted = true;
  }
  return { severity, violationCount, maxViolations: policy.maxViolations, autoSubmitted };
}

/** Finish the current timed section early; the next one starts now (the last one submits the test). */
export async function finishCurrentSection(userId: string, attemptId: string) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status !== 'in_progress') return getAttemptView(userId, attemptId);
  if (!attempt.question_order?.sections?.length) throw badRequest('This test has no timed sections.');
  const now = new Date();
  const next = finishSection(
    attempt.question_order.sections,
    { index: attempt.current_section, startedAt: new Date(attempt.section_started_at ?? attempt.started_at) },
    new Date(attempt.expires_at),
    now
  );
  if (next.finished) await finalize(attempt, 'manual');
  else await moveToSection(attempt, next.index, next.startedAt);
  return getAttemptView(userId, attemptId);
}

export async function submitAttempt(userId: string, attemptId: string) {
  const attempt = await ownAttempt(userId, attemptId);
  if (attempt.status === 'in_progress') {
    const expired = new Date(attempt.expires_at) <= new Date();
    await finalize(attempt, expired ? 'timeout' : 'manual');
  }
  return getAttemptView(userId, attemptId);
}

/**
 * An evaluator's marks and/or comment on one answer of a submitted attempt,
 * then a rescore. `marks: null` clears a manual mark (back to automatic, or
 * pending for written answers). Callers must already have proven access.
 */
export async function markAnswer(attemptId: string, questionId: string, change: { marks?: number | null; feedback?: string | null }) {
  return asSystem(async (db) => {
    const attempt = (await db.query<AttemptRow>(`select * from public.test_attempts where id = $1 for update`, [attemptId])).rows[0];
    if (!attempt) throw notFound('Attempt not found.');
    if (attempt.status !== 'completed') throw new HttpError(409, 'Marks can be given once the attempt is submitted.');
    const questions = attemptQuestions(attempt, await loadQuestions(db, attempt.test_id));
    const q = questions.find((x) => x.id === questionId);
    if (!q) throw badRequest('That question is not part of this attempt.');
    if (q.question_type === 'coding' && change.marks !== undefined) throw badRequest('Coding answers are marked by the judge. Use regrade instead.');
    if (change.marks !== undefined && change.marks !== null && (change.marks < 0 || change.marks > Number(q.marks))) {
      throw badRequest(`Give between 0 and ${Number(q.marks)} marks.`);
    }
    const answers = (attempt.answers ?? []).map((a) => {
      if (a.question_id !== questionId) return a;
      const next: AnswerState = { ...a };
      if (change.feedback !== undefined) next.feedback = change.feedback?.trim() || null;
      if (change.marks !== undefined) {
        next.manual_marks = change.marks;
        if (q.question_type === 'descriptive') next.grading = change.marks === null ? 'pending' : 'judged';
      }
      return next;
    });
    if (!answers.some((a) => a.question_id === questionId)) throw badRequest('That question is not part of this attempt.');
    const { totalScore, correctCount, totalMarks } = rescore(questions, answers);
    const { rows } = await db.query<AttemptRow>(
      `update public.test_attempts set answers = $2::jsonb, score = $3, correct_count = $4, total_marks = $5 where id = $1 returning *`,
      [attemptId, JSON.stringify(answers), totalScore, correctCount, totalMarks]);
    return { attempt: rows[0], maxMarks: Number(q.marks) };
  });
}

export async function setAttemptFeedback(attemptId: string, feedback: string | null) {
  return asSystem(async (db) => {
    const { rows } = await db.query<AttemptRow>(
      `update public.test_attempts set feedback = $2 where id = $1 and status = 'completed' returning *`, [attemptId, feedback?.trim() || null]);
    if (!rows[0]) throw new HttpError(409, 'Feedback can be given once the attempt is submitted.');
    return rows[0];
  });
}

/** Questions of a test with their marking information, for evaluators. */
export async function markingQuestions(testId: string) {
  return asSystem(async (db) => (await db.query<{
    id: string; type: string; body: string; marks: string; rubric: string | null; text_answers: string[] | null; max_words: number | null;
    judge_config: { caseSensitive?: boolean };
  }>(
    `select q.id, q.question_type as type, q.body, q.marks, q.rubric, q.text_answers, q.max_words, q.judge_config
       from public.test_questions tq join public.testseries_questions q on q.id = tq.question_id
      where tq.test_id = $1 and q.question_type in ('descriptive', 'fib')
      order by tq.sort_order, q.created_at`, [testId])).rows);
}
