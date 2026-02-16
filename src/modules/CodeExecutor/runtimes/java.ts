
import { ExecutionResult, TestCase } from "../types";

export const runJava = (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    return new Promise((resolve) => {
        // Real Java in browser requires compiling source -> bytecode -> execution.
        // There is no lightweight 'javac' in browser.
        // We simulate the experience for the UI demo.

        setTimeout(() => {
            resolve({
                status: 'Runtime Error',
                output: "Java execution requires a backend compiler or a heavy WASM environment (CheerpJ/Doppio) which is too large for this standalone demo.\n\nPlease use JavaScript or Python for full in-browser execution.",
                executionTime: 0
            });
        }, 500);
    });
};
