import { drawFromPools } from '../pools';

const qs = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, section_id: 'A' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, section_id: 'B' })),
  { id: 'loose', section_id: null },
];

describe('drawFromPools', () => {
  it('deals N of M from a pooled section and leaves the others alone', () => {
    const out = drawFromPools(qs, new Map([['A', 3]]), 'attempt-1');
    expect(out.filter((q) => q.section_id === 'A')).toHaveLength(3);
    expect(out.filter((q) => q.section_id === 'B')).toHaveLength(4);
    expect(out.map((q) => q.id)).toContain('loose');
  });

  it('is stable for one attempt and varies between attempts', () => {
    const one = drawFromPools(qs, new Map([['A', 3]]), 'attempt-1').map((q) => q.id);
    expect(drawFromPools(qs, new Map([['A', 3]]), 'attempt-1').map((q) => q.id)).toEqual(one);
    const sets = new Set(Array.from({ length: 20 }, (_, i) => drawFromPools(qs, new Map([['A', 3]]), `attempt-${i}`).map((q) => q.id).join()));
    expect(sets.size).toBeGreaterThan(5);
  });

  it('keeps authored order among the chosen questions', () => {
    const ids = drawFromPools(qs, new Map([['A', 5]]), 'x').filter((q) => q.section_id === 'A').map((q) => Number(q.id.slice(1)));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('pools the unsectioned questions under the empty key, and ignores counts >= pool size', () => {
    expect(drawFromPools(qs, new Map([['', 1], ['B', 9]]), 's')).toHaveLength(15);
    const loose = [{ id: 'x1', section_id: null }, { id: 'x2', section_id: null }, { id: 'x3', section_id: null }];
    expect(drawFromPools(loose, new Map([['', 2]]), 's')).toHaveLength(2);
  });
});
