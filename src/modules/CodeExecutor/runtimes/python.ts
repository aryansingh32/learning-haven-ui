
import { ExecutionResult, TestCase } from "../types";

export const runPython = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./pyodideWorker.ts', import.meta.url), { type: 'module' });

        const timeout = setTimeout(() => {
            worker.terminate();
            resolve({
                status: 'Time Limit Exceeded',
                output: 'Execution timed out > 10s (Python takes longer to load)',
                executionTime: 10000
            });
        }, 15000); // 15s timeout for Python (loading pyodide takes time)

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            const { type, results, logs, error } = e.data;

            if (type === 'error') {
                resolve({
                    status: 'Runtime Error',
                    output: logs + '\n\nError: ' + error
                });
            } else {
                const allPassed = results.every((r: any) => r.passed);
                const totalTime = results.reduce((acc: number, r: any) => acc + r.executionTime, 0);

                resolve({
                    status: allPassed ? 'Accepted' : 'Wrong Answer',
                    output: logs,
                    executionTime: Number(totalTime.toFixed(2)),
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
                output: `Worker Error: ${err.message}`
            });
        };

        worker.postMessage({ code, testCases });
    });
};
