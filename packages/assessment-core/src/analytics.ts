// Item analysis for a test assignment: how hard each question was, whether it
// separated stronger from weaker students, which options were picked, and how
// the batch did by topic/tag. Pure functions over scored attempts.

import { AnswerState, scoreAttempt, ScoringQuestion } from './scoring';

export interface AnalysisQuestion extends ScoringQuestion {
  options?: Array<{ id: string }> | null;
  tags?: string[];
  topic?: string | null;
}

export interface AnalysisAttempt {
  userId: string;
  answers: AnswerState[];
  /** Questions this attempt was dealt (pools); all questions when absent. */
  questionIds?: string[];
}

export interface QuestionStats {
  questionId: string;
  /** Students who were dealt the question. */
  dealt: number;
  attempted: number;
  correct: number;
  /** Share of those dealt who got it right (0–1): the classic difficulty index p. */
  difficulty: number | null;
  /** p(top 27%) − p(bottom 27%), −1…1; ≥ 0.3 separates well, < 0.1 or negative needs a look. */
  discrimination: number | null;
  averageMarks: number | null;
  /** mcq/msq/tf: how many students picked each option. */
  optionPicks?: Record<string, number>;
  pending: number;
}

export interface TagStats { tag: string; questions: number; earned: number; possible: number; percent: number | null }

export interface AssignmentAnalysis {
  students: number;
  distribution: Array<{ from: number; to: number; count: number }>;
  questions: QuestionStats[];
  tags: TagStats[];
  /** Per student: percent per tag, for topic-wise reports. */
  studentTags: Record<string, Record<string, number>>;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function analyseAssignment(questions: AnalysisQuestion[], attempts: AnalysisAttempt[]): AssignmentAnalysis {
  const scored = attempts.map((a) => {
    const dealt = a.questionIds ? new Set(a.questionIds) : null;
    const qs = dealt ? questions.filter((q) => dealt.has(q.id)) : questions;
    const r = scoreAttempt(qs, a.answers);
    return { a, qs, r, percent: r.totalMarks > 0 ? (100 * r.totalScore) / r.totalMarks : 0 };
  });

  // Score distribution in 10-point buckets (100 lands in the last one).
  const distribution = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: 0 }));
  for (const s of scored) distribution[Math.min(9, Math.max(0, Math.floor(s.percent / 10)))].count++;

  // Upper and lower 27% by overall percent.
  const ranked = [...scored].sort((x, y) => y.percent - x.percent);
  const k = Math.max(1, Math.round(ranked.length * 0.27));
  const upper = new Set(ranked.slice(0, k).map((s) => s.a.userId));
  const lower = new Set(ranked.slice(-k).map((s) => s.a.userId));

  const stats: QuestionStats[] = questions.map((q) => {
    let dealt = 0; let attempted = 0; let correct = 0; let marks = 0; let pending = 0;
    let upDealt = 0; let upRight = 0; let lowDealt = 0; let lowRight = 0;
    const picks: Record<string, number> | undefined = q.options ? Object.fromEntries(q.options.map((o) => [o.id, 0])) : undefined;
    for (const s of scored) {
      const r = s.r.perQuestion.find((x) => x.questionId === q.id);
      if (!r) continue;
      dealt++;
      if (r.attempted) attempted++;
      if (r.isCorrect) correct++;
      if (r.pending) pending++;
      marks += r.marksAwarded;
      if (upper.has(s.a.userId)) { upDealt++; if (r.isCorrect) upRight++; }
      if (lower.has(s.a.userId)) { lowDealt++; if (r.isCorrect) lowRight++; }
      if (picks) for (const o of s.a.answers.find((x) => x.question_id === q.id)?.selected_options ?? []) if (o in picks) picks[o]++;
    }
    const enough = upDealt > 0 && lowDealt > 0 && ranked.length >= 4;
    return {
      questionId: q.id, dealt, attempted, correct, pending,
      difficulty: dealt ? round(correct / dealt) : null,
      discrimination: enough ? round(upRight / upDealt - lowRight / lowDealt) : null,
      averageMarks: dealt ? round(marks / dealt) : null,
      ...(picks ? { optionPicks: picks } : {}),
    };
  });

  // Topic/tag performance: marks earned out of marks possible, over everyone dealt the question.
  const tagOf = (q: AnalysisQuestion) => [...new Set([...(q.tags ?? []), ...(q.topic ? [q.topic.toLowerCase()] : [])])];
  const tags = new Map<string, { questions: Set<string>; earned: number; possible: number }>();
  const studentTags: Record<string, Record<string, { e: number; p: number }>> = {};
  for (const s of scored) {
    for (const r of s.r.perQuestion) {
      const q = questions.find((x) => x.id === r.questionId)!;
      for (const t of tagOf(q)) {
        const agg = tags.get(t) ?? { questions: new Set(), earned: 0, possible: 0 };
        agg.questions.add(q.id); agg.earned += Math.max(0, r.marksAwarded); agg.possible += q.marks;
        tags.set(t, agg);
        const mine = (studentTags[s.a.userId] ??= {});
        const m = (mine[t] ??= { e: 0, p: 0 });
        m.e += Math.max(0, r.marksAwarded); m.p += q.marks;
      }
    }
  }

  return {
    students: scored.length,
    distribution,
    questions: stats,
    tags: [...tags].map(([tag, v]) => ({
      tag, questions: v.questions.size, earned: round(v.earned), possible: round(v.possible),
      percent: v.possible ? round((100 * v.earned) / v.possible, 1) : null,
    })).sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)),
    studentTags: Object.fromEntries(Object.entries(studentTags).map(([u, t]) => [u,
      Object.fromEntries(Object.entries(t).map(([tag, v]) => [tag, v.p ? round((100 * v.e) / v.p, 1) : 0]))])),
  };
}

export interface StudentRiskInput {
  /** Percent on each closed assignment the student was given (null = missed). */
  scores: Array<number | null>;
  overdueCourses: number;
  malpractice: boolean;
}

export interface StudentRisk { level: 'high' | 'medium' | 'low'; reasons: string[]; averagePercent: number | null; missed: number }

/** Simple, explainable at-risk rule for faculty — every flag says why. */
export function assessRisk(input: StudentRiskInput): StudentRisk {
  const taken = input.scores.filter((s): s is number => s !== null);
  const missed = input.scores.length - taken.length;
  const avg = taken.length ? round(taken.reduce((a, b) => a + b, 0) / taken.length, 1) : null;
  const reasons: string[] = [];
  let points = 0;
  if (avg !== null && avg < 40) { reasons.push(`average ${avg}% (below 40%)`); points += 3; }
  else if (avg !== null && avg < 55) { reasons.push(`average ${avg}% (below 55%)`); points += 1; }
  if (missed >= 2) { reasons.push(`missed ${missed} tests`); points += 2; }
  else if (missed === 1) { reasons.push('missed a test'); points += 1; }
  if (taken.length >= 3) {
    const last = taken.slice(-3);
    if (last[2] < last[0] - 15) { reasons.push('scores falling over the last three tests'); points += 1; }
  }
  if (input.overdueCourses > 0) { reasons.push(`${input.overdueCourses} overdue course${input.overdueCourses === 1 ? '' : 's'}`); points += 1; }
  if (input.malpractice) { reasons.push('malpractice recorded'); points += 2; }
  return { level: points >= 3 ? 'high' : points >= 1 ? 'medium' : 'low', reasons, averagePercent: avg, missed };
}
