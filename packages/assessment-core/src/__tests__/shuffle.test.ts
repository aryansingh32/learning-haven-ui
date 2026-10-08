import { buildAttemptOrder, shuffleWithSeed, OrderableQuestion } from '../shuffle';

const q = (id: string, section: string | null = null, group: string | null = null, options = ['a', 'b', 'c', 'd']): OrderableQuestion => ({
  id,
  section_id: section,
  question_group_id: group,
  options: options.map((o) => ({ id: o })),
});

describe('shuffleWithSeed', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('is deterministic for a seed and keeps every item', () => {
    const a = shuffleWithSeed(items, 'attempt-1');
    expect(shuffleWithSeed(items, 'attempt-1')).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });

  it('differs between seeds', () => {
    expect(shuffleWithSeed(items, 'attempt-1')).not.toEqual(shuffleWithSeed(items, 'attempt-2'));
  });

  it('does not mutate its input', () => {
    const copy = items.slice();
    shuffleWithSeed(items, 'x');
    expect(items).toEqual(copy);
  });
});

describe('buildAttemptOrder', () => {
  const questions = [
    q('s1-a', 'S1'), q('s1-b', 'S1'), q('s1-c', 'S1'), q('s1-d', 'S1'),
    q('s2-p1', 'S2', 'passage'), q('s2-p2', 'S2', 'passage'), q('s2-x', 'S2'), q('s2-y', 'S2'),
  ];

  it('keeps authored order when shuffling is off', () => {
    const order = buildAttemptOrder(questions, { shuffleQuestions: false, shuffleOptions: false }, 'seed');
    expect(order.questionIds).toEqual(questions.map((x) => x.id));
    expect(order.optionOrder).toEqual({});
  });

  it('never moves a question out of its section', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const ids = buildAttemptOrder(questions, { shuffleQuestions: true, shuffleOptions: false }, seed).questionIds;
      expect(ids.slice(0, 4).every((id) => id.startsWith('s1-'))).toBe(true);
      expect(ids.slice(4).every((id) => id.startsWith('s2-'))).toBe(true);
    }
  });

  it('keeps passage questions together and in order', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const ids = buildAttemptOrder(questions, { shuffleQuestions: true, shuffleOptions: false }, seed).questionIds;
      const p1 = ids.indexOf('s2-p1');
      expect(ids[p1 + 1]).toBe('s2-p2');
    }
  });

  it('gives different students different orders', () => {
    const many = Array.from({ length: 12 }, (_, i) => q(`q${i}`));
    const a = buildAttemptOrder(many, { shuffleQuestions: true, shuffleOptions: false }, 'student-a').questionIds;
    const b = buildAttemptOrder(many, { shuffleQuestions: true, shuffleOptions: false }, 'student-b').questionIds;
    expect(a).not.toEqual(b);
  });

  it('shuffles options per question, keeping every option', () => {
    const order = buildAttemptOrder([q('one'), q('two')], { shuffleQuestions: false, shuffleOptions: true }, 's');
    expect(Object.keys(order.optionOrder)).toEqual(['one', 'two']);
    expect([...order.optionOrder.one].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('skips option shuffling for questions without options', () => {
    const nat: OrderableQuestion = { id: 'nat', section_id: null, question_group_id: null, options: null };
    expect(buildAttemptOrder([nat], { shuffleQuestions: true, shuffleOptions: true }, 's').optionOrder).toEqual({});
  });
});
