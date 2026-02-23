
import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

/**
 * Run Python code using the classic Pyodide worker in the public folder.
 * Provides off-thread execution with CDN-loaded Pyodide runtime.
 */
export const runPython = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    logger.info("Python execution started (Pyodide Worker)", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    return new Promise((resolve) => {
        const worker = new Worker('/pyodideWorker.js', { type: 'classic' });

        // Pyodide initial load can take 5-10s, so we use a longer timeout
        const timeout = setTimeout(() => {
            worker.terminate();
            logger.warn("Python execution timed out");
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out (15s limit). Pyodide takes a few seconds to load on first run.',
                executionTime: 15000
            });
        }, 15000);

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error } = e.data;

            if (type === 'error') {
                logger.error("Python runtime error", { error });
                resolve({
                    status: 'Runtime Error',
                    output: (logs || '') + '\n\nError: ' + (error || ''),
                    executionTime: 0
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
