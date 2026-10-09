/**
 * Runs real JavaScript, Python and Java through the judge's development
 * runner (no Judge0 in tests), so the harnesses are exercised end to end.
 */
import { declaredJsFunctions, functionHint, judgeSolution as judgeWith, JudgeConfig, JudgeRequest, JudgeTest, JudgeUnavailableError, parseMarked } from '..';

const LOCAL: JudgeConfig = { environment: 'test' };
const judgeSolution = (req: JudgeRequest) => judgeWith(req, LOCAL);

const twoSumTests: JudgeTest[] = [
  { input: 'nums = [2,7,11,15], target = 9', expected: '[0,1]', isSample: true },
  { input: 'nums = [3,2,4], target = 6', expected: '[1,2]', isSample: true },
  { input: 'nums = [3,3], target = 6', expected: '[0,1]', isSample: false },
  { input: 'nums = [1,5,9,13,20], target = 33', expected: '[3,4]', isSample: false },
];

const JS_TWO_SUM = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
}`;

describe('problem judge', () => {
  jest.setTimeout(60_000);

  it('accepts a correct JavaScript solution on every test, hidden ones included', async () => {
    const r = await judgeSolution({ code: JS_TWO_SUM, language: 'javascript', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' });
    expect(r.verdict).toBe('Accepted');
    expect(r.passed).toBe(4);
  });

  it('accepts an answer in another order when the problem allows it', async () => {
    const reversed = JS_TWO_SUM.replace('[seen.get(target - nums[i]), i]', '[i, seen.get(target - nums[i])]');
    expect((await judgeSolution({ code: reversed, language: 'javascript', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' })).verdict).toBe('Accepted');
    expect((await judgeSolution({ code: reversed, language: 'javascript', tests: twoSumTests, compare: 'exact', hint: 'twoSum' })).verdict).toBe('Wrong Answer');
  });

  it('shows output for sample tests but never reveals hidden ones', async () => {
    const wrong = 'function twoSum(nums, target) { return [0, 0]; }';
    const r = await judgeSolution({ code: wrong, language: 'javascript', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' });
    expect(r.verdict).toBe('Wrong Answer');
    expect(r.tests[0]).toMatchObject({ isSample: true, passed: false, actual: '[0,0]' });
    expect(r.tests[2]).toEqual({ index: 2, passed: false, isSample: false });
    expect(JSON.stringify(r)).not.toContain('[3,3]');
  });

  it('finds a renamed function the same way the browser does', async () => {
    const renamed = JS_TWO_SUM.replace('function twoSum', 'function solve');
    expect((await judgeSolution({ code: renamed, language: 'javascript', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' })).verdict).toBe('Accepted');
  });

  it('reports runtime and syntax errors', async () => {
    const crash = await judgeSolution({ code: 'function twoSum(nums) { return nums.foo.bar; }', language: 'javascript', tests: twoSumTests, compare: 'exact', hint: 'twoSum' });
    expect(crash.verdict).toBe('Runtime Error');
    expect(crash.tests[0].error).toMatch(/Cannot read/);
    expect(crash.tests[2].error).toBe('Your code raised an error on this hidden test.');

    const syntax = await judgeSolution({ code: 'function twoSum(nums { return 1 }', language: 'javascript', tests: twoSumTests, compare: 'exact', hint: 'twoSum' });
    expect(syntax.verdict).toBe('Compilation Error');
  });

  it("can't be fooled by printing fake results", async () => {
    const forger = `console.log('__FORGE_x__O0:[0,1]'); function twoSum() { return [9, 9]; }`;
    expect((await judgeSolution({ code: forger, language: 'javascript', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' })).verdict).toBe('Wrong Answer');
  });

  it('judges Python (Solution class) and order-insensitive nested answers', async () => {
    const code = `class Solution:
    def groupAnagrams(self, strs):
        groups = {}
        for s in strs:
            groups.setdefault(''.join(sorted(s)), []).append(s)
        return list(groups.values())
`;
    const tests: JudgeTest[] = [
      { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', expected: '[["bat"],["nat","tan"],["ate","eat","tea"]]', isSample: true },
      { input: 'strs = ["abc","bca","cab","xyz"]', expected: '[["abc","bca","cab"],["xyz"]]', isSample: false },
    ];
    const r = await judgeSolution({ code, language: 'python', tests, compare: 'unordered_deep', hint: 'groupAnagrams' });
    expect(r.verdict).toBe('Accepted');

    const broken = await judgeSolution({ code: 'class Solution:\n    def groupAnagrams(self, strs)\n        pass\n', language: 'python', tests, compare: 'unordered_deep', hint: 'groupAnagrams' });
    expect(broken.verdict).toBe('Compilation Error');
  });

  it('judges Java through the Solution harness', async () => {
    const code = `class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int n : nums) if (!seen.add(n)) return true;
        return false;
    }
}`;
    const tests: JudgeTest[] = [
      { input: 'nums = [1,2,3,1]', expected: 'true', isSample: true },
      { input: 'nums = [1,2,3,4]', expected: 'false', isSample: false },
      { input: 'nums = []', expected: 'false', isSample: false },
    ];
    const r = await judgeSolution({ code, language: 'java', tests, compare: 'exact', hint: 'containsDuplicate' });
    expect(r.verdict).toBe('Accepted');
    expect(r.passed).toBe(3);
  });
});

describe('judge helpers', () => {
  it('reads the expected function name from starter code', () => {
    expect(functionHint('javascript', 'function twoSum(nums, target) {}')).toBe('twoSum');
    expect(functionHint('python', 'class Solution:\n    def isAnagram(self, s, t):')).toBe('isAnagram');
    expect(functionHint('java', 'class Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {')).toBe('groupAnagrams');
  });

  it('finds declared JavaScript functions in order', () => {
    expect(declaredJsFunctions('function a(){}\nconst b = (x) => x;\nlet c = function(){}')).toEqual(['a', 'b', 'c']);
  });

  it('only accepts lines with the exact marker, first one wins', () => {
    const out = parseMarked('M_O0:1\nM_O0:2\nfake_O1:3\nM_E1:boom', 'M_', 2);
    expect(out).toEqual([{ ok: true, text: '1' }, { ok: false, text: 'boom' }]);
  });
});

describe('judge configuration', () => {
  it('refuses to run code in production without Judge0', async () => {
    await expect(judgeWith({ code: 'function f(){}', language: 'javascript', tests: [{ input: 'x = 1', expected: '1', isSample: true }], compare: 'exact', hint: 'f' }, { environment: 'production' }))
      .rejects.toBeInstanceOf(JudgeUnavailableError);
  });

  it('turns an unreachable Judge0 into JudgeUnavailableError', async () => {
    await expect(judgeWith({ code: 'function f(){}', language: 'javascript', tests: [{ input: 'x = 1', expected: '1', isSample: true }], compare: 'exact', hint: 'f' }, { environment: 'production', judge0Url: 'http://127.0.0.1:9' }))
      .rejects.toBeInstanceOf(JudgeUnavailableError);
  });

  it('reports a Java compile error without running tests', async () => {
    const r = await judgeSolution({ code: 'class Solution { public int f(int[] nums) { return nums.len; } }', language: 'java', tests: [{ input: 'nums = [1]', expected: '1', isSample: true }], compare: 'exact', hint: 'f' });
    expect(r.verdict).toBe('Compilation Error');
    expect(r.message).toMatch(/error/);
  });
});
