/**
 * Judge0 sandbox runner.
 *
 * Runs untrusted Java in a self-hosted Judge0 instance (isolated containers,
 * no network, CPU/memory caps) instead of on the API host. It reuses the
 * local runner's harness and result parsing, so callers get the exact same
 * result shape from either backend.
 */

import { env } from '../../../config/env';
import logger from '../../../config/logger';
import {
    JavaExecutionResult,
    TestCase,
    TestCaseResult,
    outputMatches,
    parseHarnessOutput,
    summarize,
    wrapJavaCode,
} from './javaExecutor';

// Judge0 status ids: https://ce.judge0.com/#statuses-and-languages-status-get
const STATUS = {
    IN_QUEUE: 1,
    PROCESSING: 2,
    TIME_LIMIT: 5,
    COMPILATION_ERROR: 6,
} as const;

const LIMITS = {
    cpu_time_limit: 5,       // seconds
    wall_time_limit: 10,     // seconds
    memory_limit: 256_000,   // KB
};

const POLL_INTERVAL_MS = 300;

interface Judge0Submission {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    message: string | null;
    time: string | null;
    status: { id: number; description: string };
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string | null) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function isJudge0Configured(): boolean {
    return Boolean(env.JUDGE0_URL);
}

function headers(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        ...(env.JUDGE0_AUTH_TOKEN ? { 'X-Auth-Token': env.JUDGE0_AUTH_TOKEN } : {}),
    };
}

function baseUrl(): string {
    return (env.JUDGE0_URL || '').replace(/\/+$/, '');
}

/**
 * Judge0 compiles Java as Main.java and runs `java Main`. A user's own
 * `public class Foo` with a main method would not compile there, so drop its
 * `public` and add a Main that delegates to it.
 */
export function prepareForJudge0(source: string): string {
    // The class owning main() is the last class declared before main() appears.
    const mainAt = source.search(/public\s+static\s+void\s+main\s*\(/);
    if (mainAt < 0) return source;
    const declared = [...source.slice(0, mainAt).matchAll(/\bclass\s+(\w+)/g)];
    const owner = declared[declared.length - 1]?.[1];
    if (!owner || owner === 'Main') return source;

    const demoted = source.replace(new RegExp(`public\\s+((?:final\\s+)?class\\s+${owner}\\b)`), '$1');
    return `${demoted}\n\nclass Main {\n    public static void main(String[] args) throws Exception {\n        ${owner}.main(args);\n    }\n}\n`;
}

async function submit(source: string, stdin: string, languageId: number = env.JUDGE0_JAVA_LANGUAGE_ID): Promise<Judge0Submission> {
    const createRes = await fetch(`${baseUrl()}/submissions?base64_encoded=true&wait=false`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
            language_id: languageId,
            source_code: b64(source),
            stdin: b64(stdin),
            ...LIMITS,
        }),
    });
    if (!createRes.ok) {
        throw new Error(`Judge0 rejected the submission (HTTP ${createRes.status})`);
    }
    const { token } = (await createRes.json()) as { token: string };

    const deadline = Date.now() + env.JUDGE0_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const res = await fetch(
            `${baseUrl()}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,message,time,status`,
            { headers: headers() }
        );
        if (!res.ok) throw new Error(`Judge0 status check failed (HTTP ${res.status})`);
        const sub = (await res.json()) as Judge0Submission;
        if (sub.status.id !== STATUS.IN_QUEUE && sub.status.id !== STATUS.PROCESSING) {
            return {
                ...sub,
                stdout: unb64(sub.stdout),
                stderr: unb64(sub.stderr),
                compile_output: unb64(sub.compile_output),
                message: unb64(sub.message),
            };
        }
        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error('Judge0 did not finish in time');
}

const ms = (sub: Judge0Submission) => Math.round(parseFloat(sub.time || '0') * 1000);

function failure(sub: Judge0Submission): JavaExecutionResult | null {
    if (sub.status.id === STATUS.COMPILATION_ERROR) {
        return { status: 'Compilation Error', output: (sub.compile_output || '').trim(), executionTime: 0 };
    }
    if (sub.status.id === STATUS.TIME_LIMIT) {
        return { status: 'Time Limit Exceeded', output: 'Execution timed out', executionTime: ms(sub) };
    }
    return null;
}

/**
 * Same contract as the local executeJava(): Solution-class code runs once
 * with every test case on stdin; code with its own main runs once per case.
 */
export async function executeJavaJudge0(code: string, testCases: TestCase[]): Promise<JavaExecutionResult> {
    const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);
    const hasSolutionClass = /class\s+Solution\s*\{/.test(code);
    const source = prepareForJudge0(wrapJavaCode(code, testCases));

    try {
        if (hasSolutionClass && !hasMain) {
            const stdin = testCases.map(tc => `${tc.input}||${tc.output}`).join('\n');
            const sub = await submit(source, stdin);
            const failed = failure(sub);
            if (failed) return failed;
            if (sub.status.id >= 7) {
                return { status: 'Runtime Error', output: (sub.stderr || sub.message || sub.status.description).trim(), executionTime: ms(sub) };
            }
            return parseHarnessOutput(sub.stdout || '');
        }

        const subs = await Promise.all(testCases.map(tc => submit(source, tc.input || '')));
        const compileError = subs.find(s => s.status.id === STATUS.COMPILATION_ERROR);
        if (compileError) return failure(compileError)!;

        const results: TestCaseResult[] = subs.map((sub, i) => {
            const tc = testCases[i];
            const actual = (sub.stdout || '').trim();
            let actualOutput = actual || '(no output)';
            if (sub.status.id === STATUS.TIME_LIMIT) actualOutput = 'Time Limit Exceeded';
            else if (sub.status.id >= 7) actualOutput = (sub.stderr || sub.message || sub.status.description).trim();
            return {
                passed: sub.status.id < 5 && outputMatches(actual, tc.output),
                input: tc.input,
                expectedOutput: (tc.output || '').trim(),
                actualOutput,
                executionTime: ms(sub),
            };
        });
        return summarize(results);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Judge0 execution failed', { error: message });
        return { status: 'Runtime Error', output: 'Code runner is unavailable. Please try again shortly.', executionTime: 0 };
    }
}

export async function isJudge0Healthy(): Promise<boolean> {
    if (!isJudge0Configured()) return false;
    try {
        const res = await fetch(`${baseUrl()}/about`, { headers: headers(), signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

export interface ProgramRun {
    stdout: string;
    stderr: string;
    compileOutput: string;
    /** 'ok' | 'compile_error' | 'time_limit' | 'runtime_error' */
    outcome: 'ok' | 'compile_error' | 'time_limit' | 'runtime_error';
    timeMs: number;
}

/** Run any program on Judge0 (one submission, all input on stdin). */
export async function runOnJudge0(languageId: number, source: string, stdin: string): Promise<ProgramRun> {
    const sub = await submit(source, stdin, languageId);
    const outcome: ProgramRun['outcome'] = sub.status.id === STATUS.COMPILATION_ERROR ? 'compile_error'
        : sub.status.id === STATUS.TIME_LIMIT ? 'time_limit'
        : sub.status.id >= 7 ? 'runtime_error' : 'ok';
    return {
        stdout: sub.stdout || '',
        stderr: (sub.stderr || sub.message || (outcome === 'ok' ? '' : sub.status.description) || '').trim(),
        compileOutput: (sub.compile_output || '').trim(),
        outcome,
        timeMs: ms(sub),
    };
}
