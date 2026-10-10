// Program execution for the judge: Judge0 when configured, otherwise (outside
// production only) a local runner — child processes with a stripped
// environment and a hard time limit. The local runner has no real isolation,
// so it is a development convenience and is refused in production.

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export type RunLanguage = 'javascript' | 'python' | 'java' | 'cpp';

export interface JudgeConfig {
  /** Judge0 CE base URL. Required in production. */
  judge0Url?: string;
  judge0Token?: string;
  /** Judge0 CE language ids (63 = JavaScript, 71 = Python 3, 62 = Java, 54 = C++ GCC 9). */
  languageIds?: Partial<Record<RunLanguage, number>>;
  /** Give up on Judge0 after this long. */
  timeoutMs?: number;
  /** 'production' refuses to run code without Judge0. */
  environment: 'production' | 'development' | 'test';
}

export interface ProgramRun {
  stdout: string;
  stderr: string;
  compileOutput: string;
  outcome: 'ok' | 'compile_error' | 'time_limit' | 'runtime_error';
  timeMs: number;
  /** Peak memory of the program in KB, when the runner reports it (Judge0 does; the local runner samples it on Linux). */
  memoryKb?: number;
}

export class JudgeUnavailableError extends Error {
  constructor() {
    super('The code judge is not available right now. You can still run the sample tests.');
  }
}

const DEFAULT_IDS: Record<RunLanguage, number> = { javascript: 63, python: 71, java: 62, cpp: 54 };
const COMPILER_OPTIONS: Partial<Record<RunLanguage, string>> = { cpp: '-O2 -std=gnu++17' };

export function canJudge(config: JudgeConfig): boolean {
  return Boolean(config.judge0Url) || config.environment !== 'production';
}

// ── Judge0 ─────────────────────────────────────────────────────────────────

const STATUS = { IN_QUEUE: 1, PROCESSING: 2, TIME_LIMIT: 5, COMPILATION_ERROR: 6 } as const;
const LIMITS = { cpu_time_limit: 5, wall_time_limit: 10, memory_limit: 256_000 };
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string | null | undefined) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');

interface Judge0Submission {
  stdout: string | null; stderr: string | null; compile_output: string | null; message: string | null;
  time: string | null; memory?: number | null; status: { id: number; description: string };
}

async function runOnJudge0(config: JudgeConfig, language: RunLanguage, source: string, stdin: string): Promise<ProgramRun> {
  const base = config.judge0Url!.replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', ...(config.judge0Token ? { 'X-Auth-Token': config.judge0Token } : {}) };
  const create = await fetch(`${base}/submissions?base64_encoded=true&wait=false`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language_id: config.languageIds?.[language] ?? DEFAULT_IDS[language],
      source_code: b64(source),
      stdin: b64(stdin),
      ...(COMPILER_OPTIONS[language] ? { compiler_options: COMPILER_OPTIONS[language] } : {}),
      ...LIMITS,
    }),
  });
  if (!create.ok) throw new Error(`Judge0 rejected the submission (HTTP ${create.status})`);
  const { token } = (await create.json()) as { token: string };

  const deadline = Date.now() + (config.timeoutMs ?? 20_000);
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,message,time,memory,status`, { headers });
    if (!res.ok) throw new Error(`Judge0 status check failed (HTTP ${res.status})`);
    const sub = (await res.json()) as Judge0Submission;
    if (sub.status.id !== STATUS.IN_QUEUE && sub.status.id !== STATUS.PROCESSING) {
      const outcome: ProgramRun['outcome'] = sub.status.id === STATUS.COMPILATION_ERROR ? 'compile_error'
        : sub.status.id === STATUS.TIME_LIMIT ? 'time_limit'
        : sub.status.id >= 7 ? 'runtime_error' : 'ok';
      return {
        stdout: unb64(sub.stdout),
        stderr: (unb64(sub.stderr) || unb64(sub.message) || (outcome === 'ok' ? '' : sub.status.description)).trim(),
        compileOutput: unb64(sub.compile_output).trim(),
        outcome,
        timeMs: Math.round(parseFloat(sub.time || '0') * 1000),
        ...(judge0Memory(sub.memory) !== undefined ? { memoryKb: judge0Memory(sub.memory) } : {}),
      };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Judge0 did not finish in time');
}

/** Judge0 reports peak memory in KB (null when it couldn't measure). */
export function judge0Memory(memory: unknown): number | undefined {
  return typeof memory === 'number' && Number.isFinite(memory) && memory > 0 ? Math.round(memory) : undefined;
}

// ── Local (development only) ───────────────────────────────────────────────

const LOCAL_TIMEOUT_MS = 10_000;
const localEnv = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: os.tmpdir(), ...(process.env.JAVA_HOME ? { JAVA_HOME: process.env.JAVA_HOME } : {}),
});

/** "VmHWM:   12345 kB" → 12345 (the process's peak resident memory so far). */
export function peakKbFromStatus(status: string): number | undefined {
  const m = status.match(/^VmHWM:\s+(\d+)\s*kB/m);
  return m ? Number(m[1]) : undefined;
}

type ExecResult = { stdout: string; stderr: string; code: number | null; killed: boolean; timeMs: number; memoryKb?: number };

function exec(command: string, args: string[], cwd: string, stdin: string): Promise<ExecResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: localEnv() });
    let stdout = '';
    let stderr = '';
    let killed = false;
    // Linux only: sample the peak (VmHWM) while it runs. Approximate — the last ms or two
    // before exit can be missed — which is fine for a development runner.
    let memoryKb: number | undefined;
    const sample = () => {
      if (!child.pid) return;
      try {
        const kb = peakKbFromStatus(readFileSync(`/proc/${child.pid}/status`, 'utf8'));
        if (kb !== undefined) memoryKb = Math.max(memoryKb ?? 0, kb);
      } catch { /* exited, or not Linux */ }
    };
    const sampler = process.platform === 'linux' ? setInterval(sample, 2) : undefined;
    sample();
    const done = (r: Omit<ExecResult, 'memoryKb' | 'timeMs'>) => {
      clearTimeout(timer);
      if (sampler) clearInterval(sampler);
      resolve({ ...r, timeMs: Date.now() - started, ...(memoryKb ? { memoryKb } : {}) });
    };
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, LOCAL_TIMEOUT_MS);
    child.stdout.on('data', (d) => { if (stdout.length < 1_000_000) stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < 100_000) stderr += d; });
    child.on('exit', sample);
    child.on('error', (err) => done({ stdout, stderr: String(err), code: -1, killed }));
    child.on('close', (code) => done({ stdout, stderr, code, killed }));
    child.stdin.on('error', () => undefined);
    child.stdin.end(stdin);
  });
}

async function runLocally(language: RunLanguage, source: string, stdin: string): Promise<ProgramRun> {
  const dir = path.join(os.tmpdir(), `forge-judge-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  try {
    if (language === 'java') {
      await fs.writeFile(path.join(dir, 'Main.java'), source, 'utf8');
      const compile = await exec('javac', ['-J-Xmx256m', 'Main.java'], dir, '');
      if (compile.code !== 0) {
        return { stdout: '', stderr: '', compileOutput: (compile.stderr || compile.stdout).replace(/Picked up JAVA_TOOL_OPTIONS.*\n/g, '').trim(), outcome: 'compile_error', timeMs: 0 };
      }
      const run = await exec('java', ['-Xmx256m', 'Main'], dir, stdin);
      return toRun(run);
    }
    if (language === 'cpp') {
      await fs.writeFile(path.join(dir, 'main.cpp'), source, 'utf8');
      const compile = await exec('g++', [...COMPILER_OPTIONS.cpp!.split(' '), '-o', 'main', 'main.cpp'], dir, '');
      if (compile.code !== 0) {
        return { stdout: '', stderr: '', compileOutput: (compile.stderr || compile.stdout).trim(), outcome: 'compile_error', timeMs: 0 };
      }
      return toRun(await exec(path.join(dir, 'main'), [], dir, stdin));
    }
    const file = language === 'javascript' ? 'main.js' : 'main.py';
    await fs.writeFile(path.join(dir, file), source, 'utf8');
    const run = await exec(language === 'javascript' ? process.execPath : 'python3', [file], dir, stdin);
    return toRun(run);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function toRun(r: ExecResult): ProgramRun {
  const stderr = r.stderr.replace(/Picked up JAVA_TOOL_OPTIONS.*\n/g, '').trim();
  const memory = r.memoryKb ? { memoryKb: r.memoryKb } : {};
  if (r.killed) return { stdout: r.stdout, stderr, compileOutput: '', outcome: 'time_limit', timeMs: r.timeMs, ...memory };
  return { stdout: r.stdout, stderr, compileOutput: '', outcome: r.code === 0 ? 'ok' : 'runtime_error', timeMs: r.timeMs, ...memory };
}

/** Run one program with stdin, on Judge0 or (non-production) locally. */
export async function runProgram(config: JudgeConfig, language: RunLanguage, source: string, stdin: string): Promise<ProgramRun> {
  if (config.judge0Url) return runOnJudge0(config, language, source, stdin);
  if (config.environment === 'production') throw new JudgeUnavailableError();
  return runLocally(language, source, stdin);
}
