import { logger } from "../logger";
import { ExecutionResult, TestCase } from "../types";

/**
 * Run JavaScript code using the classic worker in the public folder.
 * DUAL MODE: Free-form (console.log output shown) OR LeetCode problem mode.
 */
export const runJavascript = (
    code: string,
    testCases: TestCase[]
): Promise<ExecutionResult> => {
    logger.info("Javascript execution started (Classic Worker)", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    return new Promise((resolve) => {
        const worker = new Worker('/javascriptWorker.js', { type: 'classic' });

        const timeout = setTimeout(() => {
            worker.terminate();
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out after 5000ms.',
                executionTime: 5000
            });
        }, 5000);

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error, freeForm } = e.data;

            if (type === 'error') {
                resolve({
                    status: 'Runtime Error',
                    output: (logs || '') + (logs ? '\n\n' : '') + 'Error: ' + (error || ''),
                    executionTime: 0
                });
            } else if (freeForm) {
                // Free-form mode: logs is the real output
                const consoleOut = (logs || '').trim() || (results?.[0]?.actualOutput ?? '(no output)');
                resolve({
                    status: 'Accepted',
                    output: consoleOut,
                    executionTime: 0,
                    freeForm: true,
                    testCaseResults: undefined
                });
            } else {
                const allPassed = results.length > 0 && results.every((r: any) => r.passed);
                const totalTime = results.reduce((acc: number, r: any) => acc + r.executionTime, 0);

                resolve({
                    status: allPassed ? 'Accepted' : 'Wrong Answer',
                    output: logs || "",
                    executionTime: Math.round(totalTime),
                    testCaseResults: results
                });
            }
            worker.terminate();
        };

        worker.onerror = (err) => {
            clearTimeout(timeout);
            worker.terminate();
            resolve({
                status: 'Runtime Error',
                output: `Worker Error: ${err.message}`,
                executionTime: 0
            });
        };

        worker.postMessage({ code, testCases });
    });
};
