
import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

export const runCpp = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    logger.info("Initializing C++ Runtime (JSCPP)", { codeLength: code.length, testCaseCount: testCases.length });

    return new Promise((resolve, reject) => {
        // Use type: 'classic' to allow importScripts in the worker
        const worker = new Worker(new URL('./cppWorker.ts', import.meta.url), { type: 'classic' });

        const timeout = setTimeout(() => {
            logger.warn("C++ Execution Timed Out");
            worker.terminate();
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out',
                executionTime: 5000
            });
        }, 5000);

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error } = e.data;

            logger.debug("C++ Worker Response", e.data);

            if (type === 'error') {
                logger.error("C++ Runtime Error", error);
                resolve({
                    status: 'Runtime Error',
                    output: logs + '\n\nError: ' + error,
                    executionTime: 0
                });
            } else {
                logger.info("C++ Execution Success", { passed: results.every((r: any) => r.passed) });
                resolve({
                    status: 'Accepted',
                    output: logs,
                    executionTime: results[0]?.executionTime || 0,
                    testCaseResults: results
                });
            }
            worker.terminate();
        };

        worker.onerror = (err) => {
            clearTimeout(timeout);
            logger.error("C++ Worker Error Event", err.message);
            worker.terminate();
            resolve({
                status: 'Runtime Error',
                output: `Worker Error: ${err.message}`,
                executionTime: 0
            });
        };

        logger.debug("Posting message to C++ worker");
        worker.postMessage({ code, testCases });
    });
};
