
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

self.onmessage = async (e: MessageEvent) => {
    const { code, testCases } = e.data;

    const results: { passed: boolean; input: string; expectedOutput: string; actualOutput: string; executionTime: number }[] = [];
    const logs: string[] = [];

    // Capture console.log
    const originalConsoleLog = console.log;
    console.log = (...args) => {
        logs.push(args.map(a => String(a)).join(' '));
        // originalConsoleLog(...args); // Optional: keep browser logging
    };

    try {
        // Basic infinite loop protection (very naive, better transforms exist)
        // For now, we rely on the main thread terminating this worker if it times out

        // We expect the user code to define a function. 
        // We need to know the function name.
        // In LeetCode, it's usually fixed, e.g., 'twoSum'.
        // Here we will try to detect it or assume a standard name based on the template.
        // For this POC, let's assume 'twoSum' or the last defined function.

        // A safer way is to wrap the code in a function block and return the target function.
        // OR we just eval it in the global scope of the worker.

        // Evaluate user code
        // usage of 'self' to store global vars
        const userCode = code + `\n
    // Find the solutions class or function
    let solutionFn = null;
    if (typeof twoSum === 'function') solutionFn = twoSum;
    // Add other function name checks here if needed
    
    if (!solutionFn) throw new Error("Could not find solution function 'twoSum'");
    solutionFn;
    `;

        // EXECUTION
        const fn = eval(userCode);

        for (const testCase of testCases) {
            // This input parsing is tricky. LeetCode inputs are usually line separated or specific headers.
            // For 'twoSum', input is "nums = [2,7,11,15], target = 9".
            // Let's assume for this MVP the input in testCase.input is valid JSON arguments separated by newline or just arguments.
            // Actually, let's assume the testCase.input IS the arguments array for apply.
            // Example input: "[2,7,11,15], 9" -> we need to parse this into arguments.

            // Improved input parsing:
            // Inputs can be raw values "2, 3" OR variable assignments "nums = [2,7,11,15], target = 9"

            let args = [];
            try {
                // First try direct JSON array parsing
                try {
                    args = JSON.parse(`[${testCase.input}]`);
                } catch (e) {
                    // Fallback: evaluate the input string as code to extract values.
                    // "nums = [2,7,11,15], target = 9" -> [ [2,7,11,15], 9 ]
                    // We wrap it in a function that returns the values.
                    // getting the values without knowing names is hard unless we assume order or just return all logic.

                    // Hacky but effective for LeetCode style: 
                    // 1. Replace "=" with ":" to make it an object-like string? No, repeated keys fail.
                    // 2. Wrap in a function and return arguments?
                    // 3. Just eval it and see what vars are set?

                    // Safest for "nums = ..., target = ..." pattern:
                    // Remove variable names and "=" signs, then parse?
                    // "nums = [1,2], target = 3" -> "[1,2], 3"

                    // Regex replacement: replace (word)(space)*=(space)* with nothing
                    const cleaned = testCase.input.replace(/[a-zA-Z_]\w*\s*=\s*/g, "");
                    args = JSON.parse(`[${cleaned}]`);
                }
            } catch (err) {
                // Final fallback: Try to evaluate it safely-ish
                try {
                    // "nums = [1,2], target = 3"
                    // we want to get [ [1,2], 3 ]
                    // Execute it and capture the values? No way to know which var is which order easily without metadata.
                    // But LeetCode usually preserves order.

                    // Let's rely on the cleaned regex version logging error if it fails
                    throw new Error(`Failed to parse input: ${testCase.input}. Error: ${err.message}`);
                } catch (e) {
                    throw e;
                }
            }

            const startTime = performance.now();
            const result = fn(...args);
            const endTime = performance.now();

            const actualStr = result !== undefined ? JSON.stringify(result) : String(result);
            const expectedStr = (testCase.output || '').trim();
            const passed = normalizeAndCompare(actualStr, expectedStr);

            results.push({
                passed,
                input: testCase.input,
                expectedOutput: expectedStr,
                actualOutput: actualStr,
                executionTime: endTime - startTime
            });
        }

        self.postMessage({
            type: 'success',
            results,
            logs: logs.join('\n')
        });

    } catch (error: any) {
        self.postMessage({
            type: 'error',
            error: error.message,
            logs: logs.join('\n')
        });
    } finally {
        console.log = originalConsoleLog;
    }
};
