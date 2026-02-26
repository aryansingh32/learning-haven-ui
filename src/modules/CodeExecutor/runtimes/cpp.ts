import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

/**
 * Run C/C++ code using the classic worker in the public folder.
 * DUAL MODE: Free-form (cout/printf output shown) OR LeetCode problem mode (detected by cin/scanf usage).
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
            const { type, results, logs, error, freeForm } = e.data;

            if (type === 'error') {
                resolve({
                    status: 'Runtime Error',
                    output: (logs || '') + (logs ? '\n\n' : '') + 'Error: ' + (error || ''),
                    executionTime: 0
                });
            } else if (freeForm) {
                // Free-form mode: the output IS the program's stdout
                const progOutput = (logs || '').trim() || (results?.[0]?.actualOutput ?? '(no output — try adding cout << "hello";)');
                resolve({
                    status: 'Accepted',
                    output: progOutput,
                    executionTime: results?.[0]?.executionTime ?? 0,
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
