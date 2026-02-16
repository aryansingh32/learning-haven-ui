import { logger } from "../logger";
import { ExecutionResult, TestCase } from "../types";

export const runJavascript = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    logger.info("Initializing Javascript Runtime", { codeLength: code.length, testCaseCount: testCases.length });

    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./jsWorker.ts', import.meta.url), { type: 'module' });

        const timeout = setTimeout(() => {
            logger.warn("Javascript Execution Timed Out");
            worker.terminate();
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out > 3000ms',
                executionTime: 3000
            });
        }, 3000); // 3s timeout

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error } = e.data;

            logger.debug("JS Worker Response", e.data);

            if (type === 'error') {
                logger.error("JS Runtime Error", error);
                resolve({
                    status: 'Runtime Error',
                    output: logs + '\n\nError: ' + error,
                    executionTime: 0
                });
            } else {
                const allPassed = results.every((r: any) => r.passed);
                const totalTime = results.reduce((acc: number, r: any) => acc + r.executionTime, 0);

                logger.info("JS Execution Success", { passed: allPassed });

                resolve({
                    status: allPassed ? 'Accepted' : 'Wrong Answer',
                    output: logs,
                    executionTime: totalTime,
                    testCaseResults: results
                });
            }
            worker.terminate();
        };

        worker.onerror = (err) => {
            clearTimeout(timeout);
            logger.error("JS Worker Error Event", err.message);
            worker.terminate();
            resolve({
                status: 'Runtime Error',
                output: `Worker Error: ${err.message}`,
                executionTime: 0
            });
        };

        logger.debug("Posting message to JS worker");
        worker.postMessage({ code, testCases });
    });
};
