import { parseQuestionSheet, QUESTION_SHEET_TEMPLATE } from '../questionSheet';

describe('parseQuestionSheet', () => {
  it('reads the template', () => {
    const r = parseQuestionSheet(QUESTION_SHEET_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.questions.slice(0, 3).map((q) => [q.type, q.correct, q.natAnswer])).toEqual([['mcq', [1], null], ['msq', [0, 2], null], ['nat', [], 36]]);
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

describe('parseQuestionSheet — true/false, fill in the blank, written, tags', () => {
  it('reads the new types and tags', () => {
    const { questions, errors } = parseQuestionSheet([
      'Type,Question,Answer,Marks,Tags,Rubric',
      'True/False,The earth is flat.,F,1,"Science, myths",',
      'fill in the blank,H2O is ___.,water|Water ,1,,',
      'essay,Describe recursion.,,5,cs,"Base case 2, step 3"',
    ].join('\n'));
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({ type: 'tf', options: ['True', 'False'], correct: [1], tags: ['science', 'myths'] });
    expect(questions[1]).toMatchObject({ type: 'fib', textAnswers: ['water', 'Water'] });
    expect(questions[2]).toMatchObject({ type: 'descriptive', rubric: 'Base case 2, step 3', marks: 5, tags: ['cs'] });
  });

  it('explains missing answers per line', () => {
    const { errors } = parseQuestionSheet('Type,Question,Answer\ntf,Sky is blue.,maybe\nfib,Blank ___,\n');
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(errors[0].message).toMatch(/True or False/);
  });

  it('the template parses cleanly', () => {
    const { questions, errors } = parseQuestionSheet(QUESTION_SHEET_TEMPLATE);
    expect(errors).toEqual([]);
    expect(questions.map((q) => q.type)).toEqual(['mcq', 'msq', 'nat', 'tf', 'fib', 'descriptive']);
  });
});
