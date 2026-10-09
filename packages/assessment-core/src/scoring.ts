// Pure scoring functions for the standalone CBT test-series engine.
// Kept dependency-free (no DB/network) so scoring correctness -- the
// most trust-critical part of this product -- is exhaustively unit
// testable without mocking anything.

export type QuestionType = 'mcq' | 'msq' | 'nat' | 'coding' | 'tf' | 'fib' | 'descriptive';

/** Types a student answers by picking options. */
export const OPTION_TYPES: readonly QuestionType[] = ['mcq', 'msq', 'tf'];
/** Types a student answers by typing text. */
export const TEXT_TYPES: readonly QuestionType[] = ['fib', 'descriptive'];
export type AnswerStatus = 'not_visited' | 'visited' | 'answered' | 'marked_for_review' | 'answered_marked';

export interface ScoringQuestion {
  id: string;
  question_type: QuestionType;
  correct_options: string[] | null; // option ids, mcq (len 1) / msq (len >= 1)
  nat_answer: number | null;
  nat_tolerance: number;
  marks: number;
  negative_marks: number;
  /** fib: accepted answers; compared ignoring case, spacing and punctuation at the ends unless caseSensitive. */
  text_answers?: string[] | null;
  case_sensitive?: boolean;
}

export interface AnswerState {
  question_id: string;
  status: AnswerStatus;
  selected_options: string[] | null;
  nat_value: number | null;
  // coding only: the saved program, and what the server judge found when the
  // attempt was submitted. Never set by the client.
  code?: string | null;
  language?: string | null;
  tests_passed?: number | null;
  tests_total?: number | null;
  /** 'pending' when the judge was unavailable at submit; staff can regrade. */
  grading?: 'judged' | 'pending' | null;
  /** fib / descriptive: what the student typed. */
  text_value?: string | null;
  /** descriptive (or any question an evaluator overrides): marks given by a person. Never set by the client. */
  manual_marks?: number | null;
  /** An evaluator's comment on this answer. Never set by the client. */
  feedback?: string | null;
}

export interface QuestionScoreResult {
  questionId: string;
  attempted: boolean;
  isCorrect: boolean | null; // null when unattempted
  marksAwarded: number;
  /** coding only: tests passed / total, and whether judging is still pending. */
  testsPassed?: number;
  testsTotal?: number;
  pending?: boolean;
}

export interface AttemptScoreResult {
  totalScore: number;
  correctCount: number;
  totalMarks: number;
  perQuestion: QuestionScoreResult[];
}

// A question only counts as "attempted" if an answer was actually saved.
// "Marked for review" with no saved selection/value is NOT attempted --
// matches GATE's own rule that a mark-only (no answer) review flag scores
// nothing, positive or negative.
function isAttempted(answer: AnswerState | undefined, questionType: QuestionType): boolean {
  if (!answer) return false;
  if (answer.status !== 'answered' && answer.status !== 'answered_marked') return false;
  if (questionType === 'nat') return answer.nat_value !== null && answer.nat_value !== undefined;
  if (questionType === 'coding') return typeof answer.code === 'string' && answer.code.trim().length > 0;
  if (TEXT_TYPES.includes(questionType)) return typeof answer.text_value === 'string' && answer.text_value.trim().length > 0;
  return Array.isArray(answer.selected_options) && answer.selected_options.length > 0;
}

/** How a typed answer is compared: trimmed, inner spaces collapsed, trailing full stop dropped, case-folded. */
export function normalizeTextAnswer(text: string, caseSensitive = false): string {
  const t = text.normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/[.。]+$/, '').trim();
  return caseSensitive ? t : t.toLowerCase();
}

export function textAnswerMatches(given: string, accepted: string[], caseSensitive = false): boolean {
  const g = normalizeTextAnswer(given, caseSensitive);
  return g.length > 0 && accepted.some((a) => normalizeTextAnswer(a, caseSensitive) === g);
}

const clampMarks = (m: number, max: number) => Math.round(Math.max(0, Math.min(max, m)) * 100) / 100;

export function scoreQuestion(question: ScoringQuestion, answer: AnswerState | undefined): QuestionScoreResult {
  const attempted = isAttempted(answer, question.question_type);
  if (!attempted) {
    return { questionId: question.id, attempted: false, isCorrect: null, marksAwarded: 0 };
  }

  // An evaluator's marks win for any non-coding question (e.g. accepting a near-miss blank).
  const manual = answer!.manual_marks;
  if (manual !== null && manual !== undefined && question.question_type !== 'coding') {
    const marks = clampMarks(manual, question.marks);
    return { questionId: question.id, attempted: true, isCorrect: marks === question.marks, marksAwarded: marks };
  }

  if (question.question_type === 'descriptive') {
    // Marked by a person; counts 0 (pending) until then.
    return { questionId: question.id, attempted: true, isCorrect: null, marksAwarded: 0, pending: true };
  }

  if (question.question_type === 'fib') {
    const ok = textAnswerMatches(answer!.text_value ?? '', question.text_answers ?? [], question.case_sensitive);
    return { questionId: question.id, attempted: true, isCorrect: ok, marksAwarded: ok ? question.marks : -question.negative_marks };
  }

  if (question.question_type === 'mcq' || question.question_type === 'tf') {
    const selected = answer!.selected_options ?? [];
    const correct = question.correct_options ?? [];
    const isCorrect = selected.length === 1 && correct.length === 1 && selected[0] === correct[0];
    return {
      questionId: question.id,
      attempted: true,
      isCorrect,
      marksAwarded: isCorrect ? question.marks : -question.negative_marks,
    };
  }

  if (question.question_type === 'msq') {
    // Must select exactly the correct set -- no negative marking, no partial credit.
    const selected = [...(answer!.selected_options ?? [])].sort();
    const correct = [...(question.correct_options ?? [])].sort();
    const isCorrect = selected.length === correct.length && selected.every((v, i) => v === correct[i]);
    return {
      questionId: question.id,
      attempted: true,
      isCorrect,
      marksAwarded: isCorrect ? question.marks : 0,
    };
  }

  if (question.question_type === 'coding') {
    // Partial marks per passed test, no negative marking. Unjudged = 0 until regraded.
    const a = answer!;
    if (a.grading !== 'judged' || !a.tests_total) {
      return { questionId: question.id, attempted: true, isCorrect: false, marksAwarded: 0, pending: a.grading !== 'judged', testsPassed: 0, testsTotal: a.tests_total ?? 0 };
    }
    const passed = Math.max(0, Math.min(a.tests_passed ?? 0, a.tests_total));
    return {
      questionId: question.id,
      attempted: true,
      isCorrect: passed === a.tests_total,
      marksAwarded: Math.round((question.marks * passed / a.tests_total) * 100) / 100,
      testsPassed: passed,
      testsTotal: a.tests_total,
    };
  }

  // NAT: exact/tolerance-range numeric grading, no negative marking.
  const value = answer!.nat_value as number;
  const target = question.nat_answer ?? 0;
  const tolerance = question.nat_tolerance ?? 0;
  const isCorrect = Math.abs(value - target) <= tolerance;
  return {
    questionId: question.id,
    attempted: true,
    isCorrect,
    marksAwarded: isCorrect ? question.marks : 0,
  };
}

export function scoreAttempt(questions: ScoringQuestion[], answers: AnswerState[]): AttemptScoreResult {
  const answerMap = new Map(answers.map((a) => [a.question_id, a]));
  const perQuestion = questions.map((q) => scoreQuestion(q, answerMap.get(q.id)));
  const totalScore = perQuestion.reduce((sum, r) => sum + r.marksAwarded, 0);
  const correctCount = perQuestion.filter((r) => r.isCorrect === true).length;
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  return { totalScore, correctCount, totalMarks, perQuestion };
}
