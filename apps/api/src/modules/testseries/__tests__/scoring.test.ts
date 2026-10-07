import { scoreQuestion, scoreAttempt, ScoringQuestion, AnswerState } from '../services/scoring';

const mcq: ScoringQuestion = {
  id: 'q-mcq',
  question_type: 'mcq',
  correct_options: ['b'],
  nat_answer: null,
  nat_tolerance: 0,
  marks: 2,
  negative_marks: 0.67,
};

const msq: ScoringQuestion = {
  id: 'q-msq',
  question_type: 'msq',
  correct_options: ['a', 'c'],
  nat_answer: null,
  nat_tolerance: 0,
  marks: 2,
  negative_marks: 0, // MSQ never has negative marking regardless of what's configured
};

const nat: ScoringQuestion = {
  id: 'q-nat',
  question_type: 'nat',
  correct_options: null,
  nat_answer: 42,
  nat_tolerance: 0.5,
  marks: 1,
  negative_marks: 0,
};

function answered(questionId: string, over: Partial<AnswerState> = {}): AnswerState {
  return {
    question_id: questionId,
    status: 'answered',
    selected_options: null,
    nat_value: null,
    ...over,
  };
}

describe('scoreQuestion — MCQ (negative marking)', () => {
  it('awards full marks for the correct option', () => {
    const result = scoreQuestion(mcq, answered('q-mcq', { selected_options: ['b'] }));
    expect(result).toEqual({ questionId: 'q-mcq', attempted: true, isCorrect: true, marksAwarded: 2 });
  });

  it('deducts the configured negative marks for a wrong option', () => {
    const result = scoreQuestion(mcq, answered('q-mcq', { selected_options: ['a'] }));
    expect(result).toEqual({ questionId: 'q-mcq', attempted: true, isCorrect: false, marksAwarded: -0.67 });
  });

  it('scores zero, not attempted, when unanswered', () => {
    const result = scoreQuestion(mcq, undefined);
    expect(result).toEqual({ questionId: 'q-mcq', attempted: false, isCorrect: null, marksAwarded: 0 });
  });

  it('treats "marked for review" with no saved answer as unattempted (no penalty)', () => {
    const result = scoreQuestion(
      mcq,
      answered('q-mcq', { status: 'marked_for_review', selected_options: null })
    );
    expect(result).toEqual({ questionId: 'q-mcq', attempted: false, isCorrect: null, marksAwarded: 0 });
  });

  it('scores a saved answer that is also marked for review ("answered_marked")', () => {
    const result = scoreQuestion(
      mcq,
      answered('q-mcq', { status: 'answered_marked', selected_options: ['b'] })
    );
    expect(result.attempted).toBe(true);
    expect(result.isCorrect).toBe(true);
    expect(result.marksAwarded).toBe(2);
  });
});

describe('scoreQuestion — MSQ (no negative marking, no partial credit)', () => {
  it('awards full marks only when the exact correct set is selected, any order', () => {
    const result = scoreQuestion(msq, answered('q-msq', { selected_options: ['c', 'a'] }));
    expect(result).toEqual({ questionId: 'q-msq', attempted: true, isCorrect: true, marksAwarded: 2 });
  });

  it('awards zero (not negative) for a partial-subset selection', () => {
    const result = scoreQuestion(msq, answered('q-msq', { selected_options: ['a'] }));
    expect(result).toEqual({ questionId: 'q-msq', attempted: true, isCorrect: false, marksAwarded: 0 });
  });

  it('awards zero (not negative) when an extra wrong option is included', () => {
    const result = scoreQuestion(msq, answered('q-msq', { selected_options: ['a', 'c', 'b'] }));
    expect(result).toEqual({ questionId: 'q-msq', attempted: true, isCorrect: false, marksAwarded: 0 });
  });

  it('scores zero, not attempted, when unanswered', () => {
    const result = scoreQuestion(msq, undefined);
    expect(result).toEqual({ questionId: 'q-msq', attempted: false, isCorrect: null, marksAwarded: 0 });
  });
});

describe('scoreQuestion — NAT (tolerance range, no negative marking)', () => {
  it('awards full marks for an exact match', () => {
    const result = scoreQuestion(nat, answered('q-nat', { nat_value: 42 }));
    expect(result).toEqual({ questionId: 'q-nat', attempted: true, isCorrect: true, marksAwarded: 1 });
  });

  it('awards full marks for a value within tolerance', () => {
    const result = scoreQuestion(nat, answered('q-nat', { nat_value: 42.4 }));
    expect(result.isCorrect).toBe(true);
    expect(result.marksAwarded).toBe(1);
  });

  it('awards zero (not negative) for a value outside tolerance', () => {
    const result = scoreQuestion(nat, answered('q-nat', { nat_value: 43 }));
    expect(result).toEqual({ questionId: 'q-nat', attempted: true, isCorrect: false, marksAwarded: 0 });
  });

  it('scores zero, not attempted, when unanswered (nat_value null)', () => {
    const result = scoreQuestion(nat, answered('q-nat', { nat_value: null }));
    expect(result).toEqual({ questionId: 'q-nat', attempted: false, isCorrect: null, marksAwarded: 0 });
  });

  it('scores zero, not attempted, when there is no saved answer row at all', () => {
    const result = scoreQuestion(nat, undefined);
    expect(result).toEqual({ questionId: 'q-nat', attempted: false, isCorrect: null, marksAwarded: 0 });
  });
});

describe('scoreAttempt — aggregate', () => {
  it('sums marks across mixed question types and counts only true positives as correct', () => {
    const questions = [mcq, msq, nat];
    const answers: AnswerState[] = [
      answered('q-mcq', { selected_options: ['a'] }), // wrong -> -0.67
      answered('q-msq', { selected_options: ['a', 'c'] }), // correct -> +2
      answered('q-nat', { nat_value: 100 }), // wrong -> 0
    ];

    const result = scoreAttempt(questions, answers);
    expect(result.totalScore).toBeCloseTo(-0.67 + 2 + 0);
    expect(result.correctCount).toBe(1);
    expect(result.totalMarks).toBe(5); // 2 + 2 + 1
    expect(result.perQuestion).toHaveLength(3);
  });

  it('returns zero score for a fully unattempted test', () => {
    const result = scoreAttempt([mcq, msq, nat], []);
    expect(result.totalScore).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.totalMarks).toBe(5);
  });
});
