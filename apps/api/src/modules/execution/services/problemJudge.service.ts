/**
 * Server-side judge for coding problems.
 *
 * The browser's Run button only checks the sample tests; a solve (and its XP)
 * is decided here, against every test including the hidden ones. Each
 * language gets a small harness that calls the learner's function exactly the
 * way the browser runner does (same `name = value` inputs, same function
 * detection), then results are compared with the shared compareOutputs().
 *
 * Execution: Judge0 when JUDGE0_URL is set. In development only, a local
 * runner (child processes with a stripped environment) stands in; production
 * refuses to run code without Judge0.
 */

import { spawn } from 'child_process';
import { randomBytes, randomUUID } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { compareOutputs, CompareMode } from '@repo/assessment-core';
import { env } from '../../../config/env';
import logger from '../../../config/logger';
import { executeJava } from './javaExecutor';
import { executeJavaJudge0, isJudge0Configured, ProgramRun, runOnJudge0 } from './judge0.service';

export const JUDGED_LANGUAGES = ['javascript', 'python', 'java'] as const;
export type JudgedLanguage = (typeof JUDGED_LANGUAGES)[number];

export interface JudgeTest {
  input: string;
  expected: string;
  isSample: boolean;
}

export type Verdict = 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compilation Error' | 'Time Limit Exceeded';

export interface TestVerdict {
  index: number;
  passed: boolean;
  isSample: boolean;
  /** Actual output or error text — reported for sample tests only. */
  actual?: string;
  error?: string;
}

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  tests: TestVerdict[];
  /** Compiler / interpreter message when the program didn't run at all. */
  message?: string;
  timeMs: number;
}

export class JudgeUnavailableError extends Error {
  constructor() {
    super('The code judge is not available right now. You can still run the sample tests.');
  }
}

export function isJudgeAvailable(): boolean {
  return isJudge0Configured() || env.NODE_ENV !== 'production';
}

// ── Harnesses ──────────────────────────────────────────────────────────────

/** Function the problem expects, read from its starter code, e.g. "twoSum". */
export function functionHint(language: JudgedLanguage, starter: string | undefined): string {
  if (!starter) return '';
  const patterns: Record<JudgedLanguage, RegExp> = {
    javascript: /function\s+([A-Za-z_$][\w$]*)\s*\(/,
    python: /def\s+([A-Za-z_]\w*)\s*\(\s*self/,
    java: /public\s+[\w<>\[\],\s]+?\s+([A-Za-z_]\w*)\s*\(/,
  };
  return starter.match(patterns[language])?.[1] ?? '';
}

/** Top-level function names in declaration order (static scan, like the browser runner). */
export function declaredJsFunctions(code: string): string[] {
  const names: string[] = [];
  const re = /(?:function\s+([a-zA-Z_$][\w$]*)\s*\()|(?:(?:var|let|const)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:function|\())/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) names.push(m[1] || m[2]);
  return names;
}

export function javascriptHarness(code: string, hint: string, marker: string): string {
  // Node 12 on Judge0 CE: keep the harness to ES2018.
  return `${code}
;(function () {
  var __inputs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  var __hint = ${JSON.stringify(hint)};
  function __find() {
    if (typeof Solution !== 'undefined') {
      var sol = new Solution();
      var methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sol)).filter(function (m) { return m !== 'constructor' && typeof sol[m] === 'function'; });
      var m = methods.indexOf(__hint) >= 0 ? __hint : methods[0];
      if (m) return sol[m].bind(sol);
    }
    // The expected name first, then the last function defined (what the browser runner picks).
    var names = ${JSON.stringify([hint, ...declaredJsFunctions(code).reverse()].filter(Boolean))};
    for (var n = 0; n < names.length; n++) {
      try { if (typeof eval(names[n]) === 'function') return eval(names[n]); } catch (e) {}
    }
    return null;
  }
  function __args(input) {
    var cleaned = String(input).replace(/[a-zA-Z_]\\w*\\s*=\\s*/g, '').trim();
    return cleaned ? JSON.parse('[' + cleaned + ']') : [];
  }
  var fn = __find();
  for (var i = 0; i < __inputs.length; i++) {
    if (!fn) { console.log(${JSON.stringify(marker)} + 'E' + i + ':No function named ' + __hint + ' found in your code.'); continue; }
    try {
      var r = fn.apply(null, __args(__inputs[i]));
      console.log(${JSON.stringify(marker)} + 'O' + i + ':' + (r === undefined ? 'null' : JSON.stringify(r)));
    } catch (e) {
      console.log(${JSON.stringify(marker)} + 'E' + i + ':' + String(e && e.message ? e.message : e).replace(/\\n/g, ' '));
    }
  }
})();
`;
}

export function pythonHarness(code: string, hint: string, marker: string): string {
  return `${code}

import json as __forge_json, re as __forge_re, sys as __forge_sys, inspect as __forge_inspect
def __forge_find(hint):
    g = globals()
    if 'Solution' in g and __forge_inspect.isclass(g['Solution']):
        sol = g['Solution']()
        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]
        if hint in methods:
            return getattr(sol, hint)
        if methods:
            return getattr(sol, methods[0])
    if hint in g and callable(g[hint]):
        return g[hint]
    # Otherwise the last function the learner defined (what the browser runner picks).
    for name in reversed(list(g.keys())):
        obj = g[name]
        if __forge_inspect.isfunction(obj) and not name.startswith('_') and obj.__module__ == '__main__':
            return obj
    return None

def __forge_main():
    marker = ${JSON.stringify(marker)}
    inputs = __forge_json.loads(__forge_sys.stdin.read())
    fn = __forge_find(${JSON.stringify(hint)})
    for i, inp in enumerate(inputs):
        if fn is None:
            print(marker + 'E' + str(i) + ':No function named ${hint || 'solution'} found in your code.')
            continue
        try:
            cleaned = __forge_re.sub(r'[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*', '', inp).strip()
            args = __forge_json.loads('[' + cleaned + ']') if cleaned else []
            r = fn(*args)
            print(marker + 'O' + str(i) + ':' + __forge_json.dumps(r, default=list))
        except Exception as e:
            print(marker + 'E' + str(i) + ':' + (type(e).__name__ + ': ' + str(e)).replace('\\n', ' '))

__forge_main()
`;
}

/** Pull per-test outputs out of the harness's stdout. */
export function parseMarked(stdout: string, marker: string, count: number): Array<{ ok: boolean; text: string } | null> {
  const out: Array<{ ok: boolean; text: string } | null> = Array.from({ length: count }, () => null);
  for (const line of stdout.split('\n')) {
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const m = rest.match(/^([OE])(\d+):(.*)$/);
    if (!m) continue;
    const idx = Number(m[2]);
    if (idx >= 0 && idx < count && out[idx] === null) out[idx] = { ok: m[1] === 'O', text: m[3] };
  }
  return out;
}

// ── Execution ──────────────────────────────────────────────────────────────

const LOCAL_TIMEOUT_MS = 10_000;
const LOCAL_ENV: NodeJS.ProcessEnv = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: os.tmpdir() };

/** Development stand-in for Judge0. Never used in production. */
async function runLocally(command: string, file: string, source: string, stdin: string): Promise<ProgramRun> {
  const dir = path.join(os.tmpdir(), `forge-judge-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, file);
  await fs.writeFile(target, source, 'utf8');
  const started = Date.now();
  try {
    return await new Promise<ProgramRun>((resolve) => {
      const child = spawn(command, [target], { cwd: dir, env: LOCAL_ENV });
      let stdout = '';
      let stderr = '';
      let killed = false;
      const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, LOCAL_TIMEOUT_MS);
      child.stdout.on('data', (d) => { if (stdout.length < 1_000_000) stdout += d; });
      child.stderr.on('data', (d) => { if (stderr.length < 100_000) stderr += d; });
      child.on('close', (code) => {
        clearTimeout(timer);
        const timeMs = Date.now() - started;
        if (killed) return resolve({ stdout, stderr, compileOutput: '', outcome: 'time_limit', timeMs });
        resolve({ stdout, stderr: stderr.trim(), compileOutput: '', outcome: code === 0 ? 'ok' : 'runtime_error', timeMs });
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(stdin);
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runProgram(language: 'javascript' | 'python', source: string, stdin: string): Promise<ProgramRun> {
  if (isJudge0Configured()) {
    const id = language === 'javascript' ? env.JUDGE0_JS_LANGUAGE_ID : env.JUDGE0_PYTHON_LANGUAGE_ID;
    return runOnJudge0(id, source, stdin);
  }
  if (env.NODE_ENV === 'production') throw new JudgeUnavailableError();
  return language === 'javascript'
    ? runLocally(process.execPath, 'main.js', source, stdin)
    : runLocally('python3', 'main.py', source, stdin);
}

// ── Judging ────────────────────────────────────────────────────────────────

function summarize(tests: JudgeTest[], verdicts: TestVerdict[], timeMs: number, message?: string): JudgeResult {
  const passed = verdicts.filter((v) => v.passed).length;
  let verdict: Verdict = passed === tests.length ? 'Accepted' : 'Wrong Answer';
  if (passed < tests.length && verdicts.some((v) => !v.passed && v.error)) verdict = 'Runtime Error';
  return { verdict, passed, total: tests.length, tests: verdicts, message, timeMs };
}

function failedRun(tests: JudgeTest[], verdict: Verdict, message: string, timeMs: number): JudgeResult {
  return {
    verdict,
    passed: 0,
    total: tests.length,
    tests: tests.map((t, index) => ({ index, passed: false, isSample: t.isSample })),
    message: message.slice(0, 4000),
    timeMs,
  };
}

/** Only sample tests reveal what the program printed; hidden tests reveal pass/fail. */
function verdictFor(t: JudgeTest, index: number, passed: boolean, actual?: string, error?: string): TestVerdict {
  return t.isSample
    ? { index, passed, isSample: true, actual, error }
    : { index, passed, isSample: false, ...(error && !passed ? { error: 'Your code raised an error on this hidden test.' } : {}) };
}

async function judgeScript(language: 'javascript' | 'python', code: string, tests: JudgeTest[], compare: CompareMode, hint: string): Promise<JudgeResult> {
  const marker = `__FORGE_${randomBytes(6).toString('hex')}__`;
  const source = language === 'javascript' ? javascriptHarness(code, hint, marker) : pythonHarness(code, hint, marker);
  const run = await runProgram(language, source, JSON.stringify(tests.map((t) => t.input)));

  if (run.outcome === 'time_limit') return failedRun(tests, 'Time Limit Exceeded', 'Your code took too long. Look for an infinite loop or a slower-than-needed approach.', run.timeMs);
  const outputs = parseMarked(run.stdout, marker, tests.length);
  if (outputs.every((o) => o === null)) {
    const syntax = /SyntaxError|IndentationError/.test(run.stderr);
    return failedRun(tests, syntax ? 'Compilation Error' : 'Runtime Error', run.stderr || 'Your code did not produce any result.', run.timeMs);
  }

  const verdicts = tests.map((t, i) => {
    const o = outputs[i];
    if (!o) return verdictFor(t, i, false, undefined, 'Your code stopped before reaching this test.');
    if (!o.ok) return verdictFor(t, i, false, undefined, o.text);
    return verdictFor(t, i, compareOutputs(o.text, t.expected, compare), o.text);
  });
  return summarize(tests, verdicts, run.timeMs);
}

async function judgeJava(code: string, tests: JudgeTest[], compare: CompareMode): Promise<JudgeResult> {
  if (!/class\s+Solution\s*\{/.test(code)) {
    return failedRun(tests, 'Compilation Error', 'Keep the Solution class from the starter code — the judge calls its method.', 0);
  }
  const cases = tests.map((t) => ({ input: t.input, output: t.expected }));
  let result;
  if (isJudge0Configured()) result = await executeJavaJudge0(code, cases);
  else if (env.NODE_ENV === 'production') throw new JudgeUnavailableError();
  else result = await executeJava(code, cases);

  if (result.status === 'Compilation Error' || result.status === 'Time Limit Exceeded') {
    return failedRun(tests, result.status, result.output || result.status, result.executionTime);
  }
  const rows = result.testCaseResults ?? [];
  if (rows.length === 0) return failedRun(tests, 'Runtime Error', result.output || 'Your code did not produce any result.', result.executionTime);

  const verdicts = tests.map((t, i) => {
    const row = rows[i];
    if (!row) return verdictFor(t, i, false, undefined, 'Your code stopped before reaching this test.');
    if (row.actualOutput.startsWith('Runtime Error')) return verdictFor(t, i, false, undefined, row.actualOutput);
    return verdictFor(t, i, compareOutputs(row.actualOutput, t.expected, compare), row.actualOutput);
  });
  return summarize(tests, verdicts, result.executionTime);
}

export async function judgeSolution(opts: {
  code: string;
  language: JudgedLanguage;
  tests: JudgeTest[];
  compare: CompareMode;
  hint: string;
}): Promise<JudgeResult> {
  const { code, language, tests, compare, hint } = opts;
  if (!isJudgeAvailable()) throw new JudgeUnavailableError();
  try {
    return language === 'java' ? await judgeJava(code, tests, compare) : await judgeScript(language, code, tests, compare, hint);
  } catch (err) {
    if (err instanceof JudgeUnavailableError) throw err;
    logger.error('Judge failed', { language, error: err instanceof Error ? err.message : String(err) });
    throw new JudgeUnavailableError();
  }
}
