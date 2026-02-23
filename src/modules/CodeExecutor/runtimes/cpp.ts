import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

/**
 * Run C/C++ code using the classic worker in the public folder.
 * This ensures execution happens off the main thread and uses JSCPP via CDN fallback.
 */
export const runCpp = (
    code: string,
    testCases: TestCase[]
): Promise<ExecutionResult> => {
    logger.info("C++ execution started (Classic Worker)", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    return new Promise((resolve) => {
        const worker = new Worker('/cppWorker.js', { type: 'classic' });

        const timeout = setTimeout(() => {
            worker.terminate();
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out after 10000ms.',
                executionTime: 10000
            });
        }, 10000);

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error } = e.data;

            if (type === 'error') {
                resolve({
                    status: 'Runtime Error',
                    output: (logs || '') + '\n\nError: ' + (error || ''),
                    executionTime: 0
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

        // Note: public/cppWorker.js handles its own input parsing/test case looping
        worker.postMessage({ code, testCases });
    });
};
