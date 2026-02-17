import { logger } from "../logger";
import { ExecutionResult, TestCase } from "../types";

function normalizeAndCompare(actual: string, expected: string): boolean {
    if (actual === expected) return true;
    try {
        const a = JSON.parse(actual);
        const b = JSON.parse(expected);
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return actual.trim() === expected.trim();
    }
}

function parseArgs(input: string): unknown[] {
    try {
        return JSON.parse(`[${input}]`);
    } catch {
        const cleaned = input.replace(/[a-zA-Z_]\w*\s*=\s*/g, "");
        return JSON.parse(`[${cleaned}]`);
    }
}

/**
 * Run JavaScript in the main thread (reliable; no worker loading issues).
 * Same logic as jsWorker but synchronous so we always get a result.
 */
function runJavascriptMainThread(code: string, testCases: TestCase[]): ExecutionResult {
    const results: { passed: boolean; input: string; expectedOutput: string; actualOutput: string; executionTime: number }[] = [];
    const logs: string[] = [];
    let totalTime = 0;
    const originalConsoleLog = console.log;
    console.log = (...args: unknown[]) => {
        logs.push(args.map((a) => String(a)).join(" "));
    };

    try {
        const userCode =
            code +
            `
    let solutionFn = null;
    if (typeof twoSum === 'function') solutionFn = twoSum;
    if (!solutionFn) throw new Error("Could not find solution function 'twoSum'");
    solutionFn;
    `;
        const fn = eval(userCode) as (...args: unknown[]) => unknown;

        for (const testCase of testCases) {
            const args = parseArgs(testCase.input);
            const startTime = performance.now();
            const result = fn(...args);
            const endTime = performance.now();
            const actualStr = result !== undefined ? JSON.stringify(result) : String(result);
            const expectedStr = (testCase.output || "").trim();
            const passed = normalizeAndCompare(actualStr, expectedStr);
            results.push({
                passed,
                input: testCase.input,
                expectedOutput: expectedStr,
                actualOutput: actualStr,
                executionTime: endTime - startTime,
            });
        }

        console.log = originalConsoleLog;
        const allPassed = results.every((r) => r.passed);
        totalTime = results.reduce((acc, r) => acc + r.executionTime, 0);
        logger.info("JS Execution Success (main thread)", { passed: allPassed });
        return {
            status: allPassed ? "Accepted" : "Wrong Answer",
            output: logs.join("\n"),
            executionTime: totalTime,
            testCaseResults: results,
        };
    } catch (error: unknown) {
        console.log = originalConsoleLog;
        const message = error instanceof Error ? error.message : String(error);
        logger.error("JS Runtime Error (main thread)", message);
        return {
            status: "Runtime Error",
            output: (logs.length ? logs.join("\n") + "\n\n" : "") + "Error: " + message,
            executionTime: 0,
            testCaseResults: results.slice(),
        };
    } finally {
        console.log = originalConsoleLog;
    }
}

export const runJavascript = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    logger.info("Initializing Javascript Runtime (main thread)", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            try {
                const result = runJavascriptMainThread(code, testCases);
                resolve(result);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error("JS Execution Failed", msg);
                resolve({
                    status: "Runtime Error",
                    output: "Execution failed: " + msg,
                    executionTime: 0,
                });
            }
        }, 0);
    });
};
