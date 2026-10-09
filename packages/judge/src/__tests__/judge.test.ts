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

  it('only accepts lines with the exact marker; a duplicate line fails the test', () => {
    const out = parseMarked('M_O0:1\nM_O0:2\nfake_O1:3\nM_E1:boom', 'M_', 2);
    expect(out).toEqual([{ ok: false, text: expect.stringMatching(/imitates the judge/) }, { ok: false, text: 'boom' }]);
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

describe('C++', () => {
  jest.setTimeout(120_000);

  const CPP_TWO_SUM = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            cout << "debug " << i << endl;   // learner's own output must not break judging
            if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`;

  it('judges a Solution class with vectors, any-order answers', async () => {
    const r = await judgeSolution({ code: CPP_TWO_SUM, language: 'cpp', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' });
    expect(r.verdict).toBe('Accepted');
    expect(r.passed).toBe(4);
    expect(r.tests[0]).toMatchObject({ isSample: true, passed: true, actual: '[0,1]' });
  });

  it('handles strings, nested vectors, doubles, bools and long long', async () => {
    const code = `class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        map<string, vector<string>> g;
        for (auto& s : strs) { string k = s; sort(k.begin(), k.end()); g[k].push_back(s); }
        vector<vector<string>> out;
        for (auto& kv : g) out.push_back(kv.second);
        return out;
    }
};`;
    const tests: JudgeTest[] = [
      { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', expected: '[["bat"],["nat","tan"],["ate","eat","tea"]]', isSample: true },
      { input: 'strs = ["a\\"b","b\\"a"]', expected: '[["a\\"b","b\\"a"]]', isSample: false },
    ];
    expect((await judgeSolution({ code, language: 'cpp', tests, compare: 'unordered_deep', hint: 'groupAnagrams' })).verdict).toBe('Accepted');

    const median = `class Solution {
public:
    double findMedianSortedArrays(vector<int>& a, vector<int>& b) {
        vector<int> m(a); m.insert(m.end(), b.begin(), b.end()); sort(m.begin(), m.end());
        int n = m.size(); return n % 2 ? m[n / 2] : (m[n / 2 - 1] + m[n / 2]) / 2.0;
    }
};`;
    const mt: JudgeTest[] = [
      { input: 'nums1 = [1,3], nums2 = [2]', expected: '2', isSample: true },
      { input: 'nums1 = [1,2], nums2 = [3,4]', expected: '2.5', isSample: false },
    ];
    expect((await judgeSolution({ code: median, language: 'cpp', tests: mt, compare: 'exact', hint: 'findMedianSortedArrays' })).verdict).toBe('Accepted');

    const misc = `class Solution {
public:
    bool check(long long big, char c, string s, bool flag) { return big > 3000000000LL && c == 'x' && s == "hé\\n" && flag; }
};`;
    const r = await judgeSolution({ code: misc, language: 'cpp', tests: [{ input: 'big = 5000000000, c = "x", s = "hé\\n", flag = true', expected: 'true', isSample: true }], compare: 'exact', hint: 'check' });
    expect(r.verdict).toBe('Accepted');
  });

  it('reports compile errors by line, not by the generated file', async () => {
    const r = await judgeSolution({ code: 'class Solution {\npublic:\n    int f(int x) { return x +; }\n};', language: 'cpp', tests: [{ input: 'x = 1', expected: '1', isSample: true }], compare: 'exact', hint: 'f' });
    expect(r.verdict).toBe('Compilation Error');
    expect(r.message).toMatch(/error/);
    expect(r.message).not.toMatch(/main\.cpp|\/tmp\//);
  });

  it('explains unsupported signatures and a learner-written main()', async () => {
    const tests: JudgeTest[] = [{ input: 'x = 1', expected: '1', isSample: true }];
    const unsupported = await judgeSolution({ code: 'class Solution {\npublic:\n    int f(map<int,int>& m) { return 1; }\n};', language: 'cpp', tests, compare: 'exact', hint: 'f' });
    expect(unsupported).toMatchObject({ verdict: 'Compilation Error' });
    expect(unsupported.message).toMatch(/can't pass or return the type/);
    const withMain = await judgeSolution({ code: 'class Solution { public: int f(int x) { return x; } };\nint main() { return 0; }', language: 'cpp', tests, compare: 'exact', hint: 'f' });
    expect(withMain.message).toMatch(/Remove main\(\)/);
  });

  it('reports a wrong input shape and exceptions per test, and survives a crash', async () => {
    const code = `class Solution {
public:
    int pick(vector<int>& nums, int i) {
        if (i == 7) raise(SIGSEGV);
        return nums.at(i);
    }
};`;
    const tests: JudgeTest[] = [
      { input: 'nums = [5,6], i = 1', expected: '6', isSample: true },
      { input: 'nums = [5,6], i = 9', expected: '0', isSample: true },
      { input: 'nums = "oops", i = 0', expected: '0', isSample: true },
      { input: 'nums = [1], i = 7', expected: '0', isSample: false },
      { input: 'nums = [1], i = 0', expected: '1', isSample: false },
    ];
    const r = await judgeSolution({ code, language: 'cpp', tests, compare: 'exact', hint: 'pick' });
    expect(r.passed).toBe(1);
    expect(r.verdict).toBe('Runtime Error');
    expect(r.tests[1].error).toMatch(/range|vector/i);
    expect(r.tests[2].error).toMatch(/doesn't match the parameters/);
    expect(r.tests[4].passed).toBe(false); // never reached after the crash
  });

  it('reads the expected method name from C++ starter code', () => {
    expect(functionHint('cpp', 'class Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string>& strs) {\n    }\n};')).toBe('groupAnagrams');
  });
});

describe('judge output tampering', () => {
  it('fails a test when the learner prints a copy of the judge result line', async () => {
    // Sloppy-mode JavaScript can read the harness source through Function.caller,
    // find the marker and print "passed" lines for every test before returning.
    const forger = `function twoSum(nums, target) {
  var src = String(twoSum.caller || '');
  var m = src.match(/__FORGE_[0-9a-f]+__/);
  if (m) for (var i = 0; i < 10; i++) console.log(m[0] + 'O' + i + ':[0,1]');
  return [9, 9];
}`;
    const r = await judgeSolution({ code: forger, language: 'javascript', tests: twoSumTests, compare: 'unordered', hint: 'twoSum' });
    expect(r.passed).toBe(0);
    expect(r.tests[0].error ?? r.tests[0].actual).toBeDefined();
  });

  it('still reports one line per test as before', () => {
    expect(parseMarked('M_O0:1\nM_E1:boom', 'M_', 2)).toEqual([{ ok: true, text: '1' }, { ok: false, text: 'boom' }]);
    expect(parseMarked('M_O0:1\nM_O0:2', 'M_', 1)[0]).toMatchObject({ ok: false });
  });
});
