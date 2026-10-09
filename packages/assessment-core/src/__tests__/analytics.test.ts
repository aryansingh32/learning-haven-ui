import { analyseAssignment, assessRisk, AnalysisQuestion, AnalysisAttempt } from '../analytics';

const q = (id: string, extra: Partial<AnalysisQuestion> = {}): AnalysisQuestion => ({
  id, question_type: 'mcq', correct_options: ['a'], nat_answer: null, nat_tolerance: 0, marks: 1, negative_marks: 0,
  options: [{ id: 'a' }, { id: 'b' }], tags: [], ...extra,
});
const pick = (qid: string, opt: string | null) => ({ question_id: qid, status: opt ? 'answered' as const : 'visited' as const, selected_options: opt ? [opt] : null, nat_value: null });

describe('analyseAssignment', () => {
  // q1: strong students right, weak wrong (discriminates). q2: everyone right (easy, no discrimination).
  const questions = [q('q1', { tags: ['arrays'] }), q('q2', { tags: ['arrays', 'basics'] })];
  const attempts: AnalysisAttempt[] = [
    { userId: 's1', answers: [pick('q1', 'a'), pick('q2', 'a')] },
    { userId: 's2', answers: [pick('q1', 'a'), pick('q2', 'a')] },
    { userId: 's3', answers: [pick('q1', 'b'), pick('q2', 'a')] },
    { userId: 's4', answers: [pick('q1', null), pick('q2', 'a')] },
  ];
  const r = analyseAssignment(questions, attempts);

  it('reports difficulty, discrimination and option picks', () => {
    const [a, b] = r.questions;
    expect(a).toMatchObject({ dealt: 4, attempted: 3, correct: 2, difficulty: 0.5, discrimination: 1, optionPicks: { a: 2, b: 1 } });
    expect(b).toMatchObject({ difficulty: 1, discrimination: 0 });
  });

  it('buckets the score distribution', () => {
    expect(r.distribution[9].count).toBe(2); // 100%
    expect(r.distribution[5].count).toBe(2); // 50%
    expect(r.distribution.reduce((n, d) => n + d.count, 0)).toBe(4);
  });

  it('adds up tag performance, weakest first, and per student', () => {
    expect(r.tags).toEqual([
      { tag: 'arrays', questions: 2, earned: 6, possible: 8, percent: 75 },
      { tag: 'basics', questions: 1, earned: 4, possible: 4, percent: 100 },
    ]);
    expect(r.studentTags.s3).toEqual({ arrays: 50, basics: 100 });
  });

  it('only counts questions a student was dealt (pools)', () => {
    const pooled = analyseAssignment(questions, [{ userId: 'x', questionIds: ['q2'], answers: [pick('q2', 'a')] }]);
    expect(pooled.questions[0].dealt).toBe(0);
    expect(pooled.questions[0].difficulty).toBeNull();
    expect(pooled.questions[1].dealt).toBe(1);
  });

  it('needs at least four students before judging discrimination', () => {
    expect(analyseAssignment(questions, attempts.slice(0, 2)).questions[0].discrimination).toBeNull();
  });
});

describe('assessRisk', () => {
  it('explains each flag', () => {
    expect(assessRisk({ scores: [30, null, 35], overdueCourses: 1, malpractice: false }))
      .toEqual({ level: 'high', reasons: ['average 32.5% (below 40%)', 'missed a test', '1 overdue course'], averagePercent: 32.5, missed: 1 });
  });
  it('notices falling scores', () => {
    expect(assessRisk({ scores: [90, 80, 70], overdueCourses: 0, malpractice: false }).reasons).toEqual(['scores falling over the last three tests']);
  });
  it('is low for a steady student', () => {
    expect(assessRisk({ scores: [72, 75, 80], overdueCourses: 0, malpractice: false })).toMatchObject({ level: 'low', reasons: [] });
  });
});

describe('assessRisk — a failing average alone', () => {
  it('is enough to be at risk', () => {
    expect(assessRisk({ scores: [37.5, 37.5], overdueCourses: 0, malpractice: false }).level).toBe('high');
  });
});
