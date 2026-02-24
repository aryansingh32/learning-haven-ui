import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

/**
 * Run Python code using the Pyodide worker.
 * DUAL MODE: Free-form (print() output shown) OR LeetCode problem mode.
 */
export const runPython = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    logger.info("Python execution started (Pyodide Worker)", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    return new Promise((resolve) => {
        const worker = new Worker('/pyodideWorker.js', { type: 'classic' });

        // Pyodide initial load can take 5-10s, so use a longer timeout
        const timeout = setTimeout(() => {
            worker.terminate();
            logger.warn("Python execution timed out");
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out (15s limit). Pyodide takes a few seconds on first run — please try again.',
                executionTime: 15000
            });
        }, 15000);

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error, freeForm } = e.data;

            if (type === 'error') {
                logger.error("Python runtime error", { error });
                resolve({
                    status: 'Runtime Error',
                    output: (logs || '') + (logs ? '\n\n' : '') + 'Error: ' + (error || ''),
                    executionTime: 0
                });
            } else if (freeForm) {
                // Free-form mode: show raw print() output
                const consoleOut = (logs || '').trim() || (results?.[0]?.actualOutput ?? '(no output — try adding a print() statement)');
                resolve({
                    status: 'Accepted',
                    output: consoleOut,
                    executionTime: 0,
                    freeForm: true,
                    testCaseResults: undefined
                });
            } else {
                const allPassed = results.length > 0 && results.every((r: any) => r.passed);
                const totalTime = results.reduce((acc: number, r: any) => acc + (r.executionTime || 0), 0);

                logger.info("Python execution completed", { allPassed, totalTime });
                resolve({
                    status: allPassed ? 'Accepted' : 'Wrong Answer',
                    output: logs || "",
                    executionTime: Number(totalTime.toFixed(2)),
                    testCaseResults: results
                });
            }
            worker.terminate();
        };

        worker.onerror = (err) => {
            clearTimeout(timeout);
            worker.terminate();
            logger.error("Python worker error", { message: err.message });
            resolve({
                status: 'Runtime Error',
                output: `Worker Error: ${err.message}`,
                executionTime: 0
            });
        };

        worker.postMessage({ code, testCases });
    });
};
