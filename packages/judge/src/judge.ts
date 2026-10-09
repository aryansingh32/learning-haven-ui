// Judge a solution against tests. Sample tests report what the program printed;
// hidden tests only report pass/fail, so their inputs and answers never leak.

import { randomBytes } from 'crypto';
import { compareOutputs, CompareMode } from '@repo/assessment-core';
import { JudgedLanguage, JudgeResult, JudgeTest, TestVerdict, Verdict, javascriptHarness, parseMarked, pythonHarness } from './harness';
import { parseHarnessOutput, prepareForJudge0, wrapJavaCode } from './java';
import { cppHarness, CppSignatureError } from './cpp';
import { canJudge, JudgeConfig, JudgeUnavailableError, runProgram } from './runner';

function summarize(tests: JudgeTest[], verdicts: TestVerdict[], timeMs: number, message?: string): JudgeResult {
  const passed = verdicts.filter((v) => v.passed).length;
  let verdict: Verdict = passed === tests.length ? 'Accepted' : 'Wrong Answer';
  if (passed < tests.length && verdicts.some((v) => !v.passed && v.error)) verdict = 'Runtime Error';
  return { verdict, passed, total: tests.length, tests: verdicts, message, timeMs };
}

function failedRun(tests: JudgeTest[], verdict: Verdict, message: string, timeMs: number): JudgeResult {
  return {
    verdict, passed: 0, total: tests.length,
    tests: tests.map((t, index) => ({ index, passed: false, isSample: t.isSample })),
    message: message.slice(0, 4000), timeMs,
  };
}

function verdictFor(t: JudgeTest, index: number, passed: boolean, actual?: string, error?: string): TestVerdict {
  return t.isSample
    ? { index, passed, isSample: true, actual, error }
    : { index, passed, isSample: false, ...(error && !passed ? { error: 'Your code raised an error on this hidden test.' } : {}) };
}

const TOO_SLOW = 'Your code took too long. Look for an infinite loop or a slower-than-needed approach.';

async function judgeScript(config: JudgeConfig, language: 'javascript' | 'python', code: string, tests: JudgeTest[], compare: CompareMode, hint: string): Promise<JudgeResult> {
  const marker = `__FORGE_${randomBytes(6).toString('hex')}__`;
  const source = language === 'javascript' ? javascriptHarness(code, hint, marker) : pythonHarness(code, hint, marker);
  const run = await runProgram(config, language, source, JSON.stringify(tests.map((t) => t.input)));

  if (run.outcome === 'time_limit') return failedRun(tests, 'Time Limit Exceeded', TOO_SLOW, run.timeMs);
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

async function judgeCpp(config: JudgeConfig, code: string, tests: JudgeTest[], compare: CompareMode, hint: string): Promise<JudgeResult> {
  if (/\bint\s+main\s*\(/.test(code)) {
    return failedRun(tests, 'Compilation Error', 'Remove main() — the judge calls your Solution method itself.', 0);
  }
  const marker = `__FORGE_${randomBytes(6).toString('hex')}__`;
  let source: string;
  try {
    source = cppHarness(code, hint, marker, tests.map((t) => t.input));
  } catch (err) {
    if (err instanceof CppSignatureError) return failedRun(tests, 'Compilation Error', err.message, 0);
    throw err;
  }
  const run = await runProgram(config, 'cpp', source, '');

  if (run.outcome === 'compile_error') return failedRun(tests, 'Compilation Error', cleanCompilerOutput(run.compileOutput), 0);
  if (run.outcome === 'time_limit') return failedRun(tests, 'Time Limit Exceeded', TOO_SLOW, run.timeMs);
  const outputs = parseMarked(run.stdout, marker, tests.length);
  if (outputs.every((o) => o === null)) return failedRun(tests, 'Runtime Error', run.stderr || 'Your code crashed before finishing the first test.', run.timeMs);
  const verdicts = tests.map((t, i) => {
    const o = outputs[i];
    if (!o) return verdictFor(t, i, false, undefined, 'Your code crashed or stopped before reaching this test.');
    if (!o.ok) return verdictFor(t, i, false, undefined, o.text);
    return verdictFor(t, i, compareOutputs(o.text, t.expected, compare), o.text);
  });
  return summarize(tests, verdicts, run.timeMs);
}

/** Compiler errors mention the generated file; keep only what helps the learner. */
function cleanCompilerOutput(text: string): string {
  return (text || 'Your code did not compile.').replace(/(?:\/[^\s:]*)?main\.cpp:/g, 'line ').slice(0, 4000);
}

async function judgeJava(config: JudgeConfig, code: string, tests: JudgeTest[], compare: CompareMode): Promise<JudgeResult> {
  if (!/class\s+Solution\s*\{/.test(code)) {
    return failedRun(tests, 'Compilation Error', 'Keep the Solution class from the starter code — the judge calls its method.', 0);
  }
  // Inputs only: expected outputs never enter the learner's program (it could read
  // its own stdin or source file). Answers are compared here, outside it.
  const cases = tests.map((t) => ({ input: t.input, output: '' }));
  const source = prepareForJudge0(wrapJavaCode(code, cases));
  const run = await runProgram(config, 'java', source, cases.map((c) => `${c.input}||`).join('\n'));

  if (run.outcome === 'compile_error') return failedRun(tests, 'Compilation Error', run.compileOutput || 'Your code did not compile.', 0);
  if (run.outcome === 'time_limit') return failedRun(tests, 'Time Limit Exceeded', TOO_SLOW, run.timeMs);
  const rows = parseHarnessOutput(run.stdout).testCaseResults ?? [];
  if (rows.length === 0) return failedRun(tests, 'Runtime Error', run.stderr || 'Your code did not produce any result.', run.timeMs);

  const verdicts = tests.map((t, i) => {
    const row = rows[i];
    if (!row) return verdictFor(t, i, false, undefined, 'Your code stopped before reaching this test.');
    if (row.actualOutput.startsWith('Runtime Error')) return verdictFor(t, i, false, undefined, row.actualOutput);
    return verdictFor(t, i, compareOutputs(row.actualOutput, t.expected, compare), row.actualOutput);
  });
  return summarize(tests, verdicts, run.timeMs);
}

export interface JudgeRequest {
  code: string;
  language: JudgedLanguage;
  tests: JudgeTest[];
  compare: CompareMode;
  /** Function the problem expects (see functionHint). */
  hint: string;
}

export async function judgeSolution(req: JudgeRequest, config: JudgeConfig): Promise<JudgeResult> {
  if (!canJudge(config)) throw new JudgeUnavailableError();
  if (req.tests.length === 0) return { verdict: 'Accepted', passed: 0, total: 0, tests: [], timeMs: 0 };
  try {
    if (req.language === 'java') return await judgeJava(config, req.code, req.tests, req.compare);
    if (req.language === 'cpp') return await judgeCpp(config, req.code, req.tests, req.compare, req.hint);
    return await judgeScript(config, req.language, req.code, req.tests, req.compare, req.hint);
  } catch (err) {
    if (err instanceof JudgeUnavailableError) throw err;
    // Judge0 unreachable / misbehaving: callers decide (practice: retry later; exams: grading pending).
    const e = new JudgeUnavailableError();
    (e as Error & { cause?: unknown }).cause = err;
    throw e;
  }
}
