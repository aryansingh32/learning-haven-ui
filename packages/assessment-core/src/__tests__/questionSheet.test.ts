import { parseQuestionSheet, QUESTION_SHEET_TEMPLATE } from '../questionSheet';

describe('parseQuestionSheet', () => {
  it('reads the template', () => {
    const r = parseQuestionSheet(QUESTION_SHEET_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => [q.type, q.correct, q.natAnswer])).toEqual([['mcq', [1], null], ['msq', [0, 2], null], ['nat', [], 36]]);
    expect(r.questions[0]).toMatchObject({ section: 'Aptitude', difficulty: 'easy', negativeMarks: 0.25, marks: 1 });
  });

  it('accepts other header and answer styles, and infers the type', () => {
    const csv = 'question,a,b,c,answer\nCapital of India?,Mumbai,Delhi,Pune,Delhi\nPick primes,2,4,5,1 and 3\n2+2?,,,,4';
    const r = parseQuestionSheet(csv);
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => [q.type, q.correct])).toEqual([['mcq', [1]], ['msq', [0, 2]], ['nat', []]]);
  });

  it('reports each bad row by its line and keeps the good ones', () => {
    const csv = [
      'Type,Question,Option A,Option B,Answer,Marks',
      'mcq,Fine?,Yes,No,A,1',
      'mcq,,Yes,No,A,1',
      'mcq,Two answers?,Yes,No,"A,B",1',
      'mcq,Bad letter?,Yes,No,E,1',
      'nat,Number?,,,abc,1',
      'quiz,Odd type,Yes,No,A,1',
      'mcq,Bad marks,Yes,No,A,-2',
      'mcq,One option,Yes,,A,1',
    ].join('\n');
    const r = parseQuestionSheet(csv);
    expect(r.questions).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(r.errors[2].message).toMatch(/doesn't match any option/);
  });

  it('needs a Question column and refuses huge files', () => {
    expect(parseQuestionSheet('foo,bar\n1,2').errors[0].message).toMatch(/Question/);
    const big = ['Question,Answer', ...Array.from({ length: 501 }, (_, i) => `Q${i},1`)].join('\n');
    expect(parseQuestionSheet(big).errors[0].message).toMatch(/up to 500/);
  });

  it('ignores negative marks on questions where they do not apply', () => {
    const r = parseQuestionSheet('Type,Question,A,B,Answer,Negative marks\nmsq,Q,x,y,"A,B",1');
    expect(r.questions[0].negativeMarks).toBe(0);
  });
});
