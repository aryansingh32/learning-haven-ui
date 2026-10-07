/**
 * Judge0 runner tests — Judge0 itself is mocked at the fetch level.
 *
 * Verifies that:
 * 1. A user's own `public class Foo` with main() gets a delegating Main.
 * 2. Solution-class code is sent once, with every case on stdin, and parsed.
 * 3. Main-method code runs once per case and compares output loosely.
 * 4. Compilation errors and time limits map to the existing statuses.
 * 5. An unreachable Judge0 returns a friendly Runtime Error, not a throw.
 */

process.env.JUDGE0_URL = 'http://judge0.test';

import { executeJavaJudge0, prepareForJudge0 } from '../modules/execution/services/judge0.service';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string) => Buffer.from(s, 'base64').toString('utf8');

type Fake = { status: number; stdout?: string; compile_output?: string; stderr?: string; time?: string };

/** Each POST gets the next fake result; GET returns it. Records submitted bodies. */
function mockJudge0(results: Fake[]) {
  const submitted: any[] = [];
  let n = 0;
  const byToken = new Map<string, Fake>();
  global.fetch = jest.fn(async (url: any, init?: any) => {
    if (init?.method === 'POST') {
      const token = `t${n}`;
      submitted.push(JSON.parse(init.body));
      byToken.set(token, results[n++] ?? results[results.length - 1]);
      return { ok: true, json: async () => ({ token }) } as any;
    }
    const token = String(url).split('/submissions/')[1].split('?')[0];
    const r = byToken.get(token)!;
    return {
      ok: true,
      json: async () => ({
        stdout: r.stdout ? b64(r.stdout) : null,
        stderr: r.stderr ? b64(r.stderr) : null,
        compile_output: r.compile_output ? b64(r.compile_output) : null,
        message: null,
        time: r.time ?? '0.05',
        status: { id: r.status, description: 'x' },
      }),
    } as any;
  }) as any;
  return submitted;
}

describe('prepareForJudge0', () => {
  it('leaves code whose main lives in Main untouched', () => {
    const src = 'public class Main { public static void main(String[] a) {} }';
    expect(prepareForJudge0(src)).toBe(src);
  });

  it('demotes a public non-Main class and adds a delegating Main', () => {
    const out = prepareForJudge0('public class Hello { public static void main(String[] a) { System.out.println(1); } }');
    expect(out).toMatch(/^class Hello/);
    expect(out).toContain('Hello.main(args);');
  });

  it('picks the class that actually declares main, not the first class', () => {
    const src = 'class Solution { int f() { return 1; } }\nclass Main { public static void main(String[] a) {} }';
    expect(prepareForJudge0(src)).toBe(src);
  });
});

describe('executeJavaJudge0', () => {
  it('runs Solution-mode code once with all cases on stdin', async () => {
    const submitted = mockJudge0([{ status: 3, stdout: '__RESULT__:true||1||2||2||3\n__RESULT__:false||2||4||5||1\n' }]);
    const result = await executeJavaJudge0('class Solution { public int f(int x) { return x + 1; } }', [
      { input: '1', output: '2' },
      { input: '2', output: '4' },
    ]);
    expect(submitted).toHaveLength(1);
    expect(unb64(submitted[0].stdin)).toBe('1||2\n2||4');
    expect(submitted[0].memory_limit).toBe(256000);
    expect(result.status).toBe('Wrong Answer');
    expect(result.testCaseResults?.map(r => r.passed)).toEqual([true, false]);
  });

  it('runs main-method code once per case, ignoring whitespace differences', async () => {
    const submitted = mockJudge0([{ status: 3, stdout: '1 2 3\n' }, { status: 3, stdout: '9\n' }]);
    const result = await executeJavaJudge0('public class Main { public static void main(String[] a) {} }', [
      { input: 'a', output: '1  2 3' },
      { input: 'b', output: '9' },
    ]);
    expect(submitted).toHaveLength(2);
    expect(result.status).toBe('Accepted');
  });

  it('maps a compilation error', async () => {
    mockJudge0([{ status: 6, compile_output: 'Main.java:1: error: ; expected' }]);
    const result = await executeJavaJudge0('class Solution { int f( }', [{ input: '1', output: '1' }]);
    expect(result).toEqual({ status: 'Compilation Error', output: 'Main.java:1: error: ; expected', executionTime: 0 });
  });

  it('marks a timed-out case as failed in main mode', async () => {
    mockJudge0([{ status: 5 }]);
    const result = await executeJavaJudge0('public class Main { public static void main(String[] a) { while (true) {} } }', [
      { input: '', output: 'x' },
    ]);
    expect(result.status).toBe('Wrong Answer');
    expect(result.testCaseResults?.[0].actualOutput).toBe('Time Limit Exceeded');
  });

  it('returns a friendly error when Judge0 is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    const result = await executeJavaJudge0('class Solution {}', [{ input: '1', output: '1' }]);
    expect(result.status).toBe('Runtime Error');
    expect(result.output).toMatch(/unavailable/);
  });
});
