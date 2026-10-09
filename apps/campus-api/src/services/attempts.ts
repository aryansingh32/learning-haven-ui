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
  shouldAutoSubmit,
} from '@repo/assessment-core';
import { asSystem, asUser, Db } from '../db';
import { badRequest, HttpError, notFound } from '../errors';
import { JudgedLanguage, judgeCode, JudgeUnavailableError, languagesOf, StarterCode } from './judge';

interface QuestionRow {
  id: string;
  question_group_id: string | null;
  question_type: 'mcq' | 'msq' | 'nat' | 'coding';
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
  judge_config: { compare?: string };
}

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
  question_order: { questionIds: string[]; optionOrder: Record<string, string[]> } | null;
  violation_count: number;
  submit_reason: string | null;
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
}

const toScoring = (q: QuestionRow): ScoringQuestion => ({
  id: q.id,
  question_type: q.question_type,
  correct_options: q.correct_options,
  nat_answer: q.nat_answer !== null ? Number(q.nat_answer) : null,
  nat_tolerance: Number(q.nat_tolerance ?? 0),
  marks: Number(q.marks),
  negative_marks: Number(q.negative_marks ?? 0),
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
            tq.section_id, s.name as section_name, g.stimulus
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
              shuffle_questions, shuffle_options, result_release, results_released_at, proctoring
         from campus.assignments
        where id = $1 and status = 'published' and campus.is_batch_member(batch_id)`,
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
async function finalize(attempt: AttemptRow, reason: 'manual' | 'timeout' | 'violations' | 'closed'): Promise<AttemptRow> {
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
    let needsJudge = false;
    const answers = (rows[0].answers ?? []).map((a) => {
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

async function closeIfExpired(attempt: AttemptRow): Promise<AttemptRow> {
  if (attempt.status !== 'in_progress' || new Date(attempt.expires_at) > new Date()) return attempt;
  return finalize(attempt, 'timeout');
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
    const test = await db.query<{ duration_seconds: number }>(`select duration_seconds from public.tests where id = $1`, [assignment.test_id]);
    const questions = await loadQuestions(db, assignment.test_id);
    if (questions.length === 0) throw badRequest('This test has no questions yet. Ask your faculty.');

    const duration = assignment.duration_seconds ?? test.rows[0].duration_seconds;
    const order = buildAttemptOrder(
      questions,
      { shuffleQuestions: assignment.shuffle_questions, shuffleOptions: assignment.shuffle_options },
      attemptId
    );
    const initialAnswers: AnswerState[] = order.questionIds.map((id) => ({
      question_id: id, status: 'not_visited', selected_options: null, nat_value: null,
    }));
    const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);

    try {
      await db.query(
        `insert into public.test_attempts
           (id, user_id, test_id, assignment_id, org_id, attempt_number, status, started_at,
            expires_at, answers, total_questions, total_marks, question_order)
         values ($1, $2, $3, $4, $5, $6, 'in_progress', now(),
                 least(now() + make_interval(secs => $7::int), $8::timestamptz), $9::jsonb, $10, $11, $12::jsonb)`,
        [attemptId, userId, assignment.test_id, assignment.id, assignment.org_id, used + 1,
         duration, assignment.closes_at, JSON.stringify(initialAnswers), questions.length, totalMarks, JSON.stringify(order)]
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

export async function getAttemptView(userId: string, attemptId: string) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
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

  const publicQuestions = attempt.status === 'in_progress'
    ? order.questionIds.filter((id) => byId.has(id)).map((id) => {
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
    answers: attempt.status === 'in_progress' ? attempt.answers : undefined,
    submitReason: attempt.submit_reason,
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
    perQuestion: scored.perQuestion,
  };
}

export async function saveAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  payload: { selectedOptions?: string[] | null; natValue?: number | null; code?: string | null; language?: string | null; markedForReview?: boolean }
) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'Time is up — this attempt has been submitted.');

  const answers: AnswerState[] = attempt.answers ?? [];
  const idx = answers.findIndex((a) => a.question_id === questionId);
  if (idx < 0) throw badRequest('That question is not part of this test.');

  const question = await asSystem(async (db) => (await db.query<Pick<QuestionRow, 'options' | 'question_type' | 'starter_code'>>(
    `select options, question_type, starter_code from public.testseries_questions where id = $1`, [questionId]
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
  } else {
    if (payload.code) throw badRequest('Only coding questions take code.');
    if (payload.selectedOptions?.length) {
      const ids = new Set((question.options ?? []).map((o) => o.id));
      const single = question.question_type === 'mcq';
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
      `update public.test_attempts set answers = $2::jsonb
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

export async function submitAttempt(userId: string, attemptId: string) {
  const attempt = await ownAttempt(userId, attemptId);
  if (attempt.status === 'in_progress') {
    const expired = new Date(attempt.expires_at) <= new Date();
    await finalize(attempt, expired ? 'timeout' : 'manual');
  }
  return getAttemptView(userId, attemptId);
}
