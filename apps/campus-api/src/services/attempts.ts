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

interface QuestionRow {
  id: string;
  question_group_id: string | null;
  question_type: 'mcq' | 'msq' | 'nat';
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
            q.nat_answer, q.nat_tolerance, q.marks, q.negative_marks,
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

/** Score from saved answers and close the attempt. Idempotent under races. */
async function finalize(attempt: AttemptRow, reason: 'manual' | 'timeout' | 'violations' | 'closed'): Promise<AttemptRow> {
  return asSystem(async (db) => {
    const questions = attemptQuestions(attempt, await loadQuestions(db, attempt.test_id));
    const { totalScore, correctCount, totalMarks } = scoreAttempt(questions.map(toScoring), attempt.answers ?? []);
    const { rows } = await db.query<AttemptRow>(
      `update public.test_attempts
          set status = 'completed', submitted_at = least(now(), expires_at),
              score = $2, correct_count = $3, total_marks = $4, submit_reason = $5
        where id = $1 and status = 'in_progress'
        returning *`,
      [attempt.id, totalScore, correctCount, totalMarks, reason]
    );
    if (rows[0]) return rows[0];
    const fresh = await db.query<AttemptRow>(`select * from public.test_attempts where id = $1`, [attempt.id]);
    return fresh.rows[0];
  });
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
  payload: { selectedOptions?: string[] | null; natValue?: number | null; markedForReview?: boolean }
) {
  const attempt = await closeIfExpired(await ownAttempt(userId, attemptId));
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'Time is up — this attempt has been submitted.');

  const answers: AnswerState[] = attempt.answers ?? [];
  const idx = answers.findIndex((a) => a.question_id === questionId);
  if (idx < 0) throw badRequest('That question is not part of this test.');

  if (payload.selectedOptions?.length) {
    const valid = await asSystem(async (db) => {
      const { rows } = await db.query<{ options: Array<{ id: string }> | null; question_type: string }>(
        `select options, question_type from public.testseries_questions where id = $1`, [questionId]
      );
      const ids = new Set((rows[0]?.options ?? []).map((o) => o.id));
      const single = rows[0]?.question_type === 'mcq';
      return payload.selectedOptions!.every((o) => ids.has(o)) && (!single || payload.selectedOptions!.length === 1);
    });
    if (!valid) throw badRequest('That answer is not one of the options.');
  }

  const hasAnswer = Boolean(payload.selectedOptions?.length) || (payload.natValue !== undefined && payload.natValue !== null);
  const status = hasAnswer
    ? (payload.markedForReview ? 'answered_marked' : 'answered')
    : (payload.markedForReview ? 'marked_for_review' : 'visited');
  answers[idx] = {
    question_id: questionId,
    status,
    selected_options: payload.selectedOptions?.length ? payload.selectedOptions : null,
    nat_value: payload.natValue ?? null,
  };

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
