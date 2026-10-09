import { compareOutputs, parseLoose } from '../judging';

describe('parseLoose', () => {
  it('reads JSON, Python repr and Java toString the same way', () => {
    expect(parseLoose('[["eat","tea"],["bat"]]')).toEqual([['eat', 'tea'], ['bat']]);
    expect(parseLoose("[['eat', 'tea'], ['bat']]")).toEqual([['eat', 'tea'], ['bat']]);
    expect(parseLoose('[[eat, tea], [bat]]')).toEqual([['eat', 'tea'], ['bat']]);
    expect(parseLoose('True')).toBe(true);
    expect(parseLoose('None')).toBeNull();
    expect(parseLoose('[0, 1]')).toEqual([0, 1]);
    expect(parseLoose('2.50')).toBe(2.5);
  });

  it('keeps plain text as text', () => {
    expect(parseLoose('hello world')).toBe('hello world');
    expect(parseLoose('[1, 2] trailing')).toBe('[1, 2] trailing');
  });
});

describe('compareOutputs', () => {
  it('matches across language print styles', () => {
    expect(compareOutputs('[0, 1]', '[0,1]')).toBe(true);
    expect(compareOutputs('true', 'True')).toBe(true);
    expect(compareOutputs('2.0', '2')).toBe(true);
    expect(compareOutputs('2.5', '2.50000')).toBe(true);
  });

  it('respects order unless the problem says otherwise', () => {
    expect(compareOutputs('[1,0]', '[0,1]')).toBe(false);
    expect(compareOutputs('[2,1]', '[1,2]', 'unordered')).toBe(true);
    // unordered only relaxes the top level
    expect(compareOutputs('[[2,1]]', '[[1,2]]', 'unordered')).toBe(false);
    expect(compareOutputs('[[tea, eat], [bat]]', '[["bat"],["eat","tea"]]', 'unordered_deep')).toBe(true);
  });

  it('rejects real differences', () => {
    expect(compareOutputs('[1,2,3]', '[1,2]', 'unordered')).toBe(false);
    expect(compareOutputs('[1,1,2]', '[1,2,2]', 'unordered')).toBe(false);
    expect(compareOutputs('false', 'true')).toBe(false);
    expect(compareOutputs('2.51', '2.5')).toBe(false);
    expect(compareOutputs('"1"', '1')).toBe(false);
  });
});
