import { codeFingerprint, containment, fastAndHighScoring, normalizeCode, similarPairs, textFingerprint } from '../similarity';

const original = `
def two_sum(nums, target):
    # remember where each value was seen
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []

def max_profit(prices):
    best = 0
    low = prices[0]
    for p in prices[1:]:
        low = min(low, p)
        best = max(best, p - low)
    return best
`;

// The same program with every name changed, comments rewritten and spacing changed.
const disguised = `
def two_sum(arr, k):
    """Find the pair."""
    index_of = {}
    for j, value in enumerate(arr):
        other = k - value
        if other in index_of:
            return [index_of[other], j]   # found it
        index_of[value] = j
    return []
def max_profit(costs):
    answer = 0
    cheapest = costs[0]
    for c in costs[1:]:
        cheapest = min(cheapest, c)
        answer = max(answer, c - cheapest)
    return answer
`;

// An honest, different solution to the same problems.
const different = `
def two_sum(nums, target):
    order = sorted(range(len(nums)), key=lambda i: nums[i])
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        s = nums[order[lo]] + nums[order[hi]]
        if s == target:
            return sorted([order[lo], order[hi]])
        if s < target:
            lo += 1
        else:
            hi -= 1
    return []

def max_profit(prices):
    total = 0
    for a, b in zip(prices, prices[1:]):
        total = max(total, max(0, b - a) + total * 0)
    return max([b - a for a in prices for b in prices] + [0])
`;

describe('code similarity', () => {
  it('sees through renamed variables, comments and spacing', () => {
    expect(normalizeCode('x = 1 # set\nfoo = "hi"')).toEqual(normalizeCode('count = 42 # other\nbar = \'yo\''));
    expect(containment(codeFingerprint(original), codeFingerprint(disguised))).toBeGreaterThan(0.85);
  });
  it('does not flag an honest, different solution', () => {
    expect(containment(codeFingerprint(original), codeFingerprint(different))).toBeLessThan(0.5);
  });
  it('ignores what came from the starter code', () => {
    const starter = original;
    const a = codeFingerprint(original, starter);
    expect(a.prints.size).toBe(0);
    expect(similarPairs([{ id: 'a', fingerprint: a }, { id: 'b', fingerprint: codeFingerprint(disguised, starter) }])).toEqual([]);
  });
  it('reports similar pairs, most similar first, and skips tiny answers', () => {
    const pairs = similarPairs([
      { id: 'x', fingerprint: codeFingerprint(original) },
      { id: 'y', fingerprint: codeFingerprint(disguised) },
      { id: 'z', fingerprint: codeFingerprint(different) },
      { id: 't1', fingerprint: codeFingerprint('return a + b') },
      { id: 't2', fingerprint: codeFingerprint('return a + b') },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 'x', b: 'y' });
  });
});

describe('written answer similarity', () => {
  const essay = 'A process is a program in execution with its own memory space while a thread shares the memory of its process and is cheaper to create and switch between';
  it('flags copied text with small edits, not unrelated text', () => {
    const copied = essay.replace('cheaper', 'much cheaper').toUpperCase();
    expect(containment(textFingerprint(essay), textFingerprint(copied))).toBeGreaterThan(0.7);
    expect(containment(textFingerprint(essay), textFingerprint('Threads are lightweight units of scheduling inside a process and they communicate through shared variables guarded by locks'))).toBeLessThan(0.2);
  });
});

describe('timing', () => {
  const attempts = [
    { id: 'a', durationSeconds: 3000, scorePercent: 70 },
    { id: 'b', durationSeconds: 2800, scorePercent: 65 },
    { id: 'c', durationSeconds: 3200, scorePercent: 82 },
    { id: 'd', durationSeconds: 2900, scorePercent: 55 },
    { id: 'fast', durationSeconds: 600, scorePercent: 95 },
    { id: 'quick-but-poor', durationSeconds: 500, scorePercent: 20 },
  ];
  it('flags a top score finished far faster than the class', () => {
    expect(fastAndHighScoring(attempts)).toEqual(['fast']);
  });
  it('says nothing with too few attempts', () => {
    expect(fastAndHighScoring(attempts.slice(0, 4))).toEqual([]);
  });
});
