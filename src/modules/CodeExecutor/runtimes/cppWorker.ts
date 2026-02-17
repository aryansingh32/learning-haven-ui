/* global importScripts */
// Shim for CommonJS bundle
const fakeModule: { exports: Record<string, unknown> } = { exports: {} };
(self as unknown as { module: typeof fakeModule }).module = fakeModule;
(self as unknown as { exports: typeof fakeModule.exports }).exports = fakeModule.exports;

importScripts("/jscpp.js");

type JSCPPRun = (code: string, input: string, config?: { stdio?: { write?: (s: string) => void; writeError?: (s: string) => void } }) => number;

self.onmessage = async (e: MessageEvent) => {
    const { code, testCases } = e.data as { code: string; testCases: { input: string; output: string }[] };
    const results: { passed: boolean; input: string; expectedOutput: string; actualOutput: string; executionTime: number }[] = [];
    let allLogs = "";

    try {
        let JSCPP = (self as unknown as { module: { exports: unknown } }).module.exports as { run?: JSCPPRun } | JSCPPRun;
        if (JSCPP && typeof (JSCPP as { default?: unknown }).default === "function") {
            JSCPP = (JSCPP as { default: JSCPPRun }).default;
        }
        if (!JSCPP || typeof (JSCPP as JSCPPRun) !== "function" && typeof (JSCPP as { run?: JSCPPRun }).run !== "function") {
            if ((self as unknown as { JSCPP?: unknown }).JSCPP) {
                JSCPP = (self as unknown as { JSCPP: typeof JSCPP }).JSCPP;
            }
        }
        const run = (typeof JSCPP === "function" ? JSCPP : (JSCPP as { run: JSCPPRun }).run) as JSCPPRun;
        if (typeof run !== "function") {
            throw new Error("JSCPP.run not found. Got: " + typeof JSCPP + " " + (JSCPP && Object.keys(JSCPP).join(",")));
        }

        const hasMain = /int\s+main\s*\s*\(/.test(code);
        const executableCode = hasMain
            ? code
            : code + "\n#include <iostream>\nint main() { std::cout << \"Add int main() to run your program.\"; return 0; }\n";

        for (const tc of testCases) {
            let logs = "";
            const config = {
                stdio: {
                    write: (s: string) => {
                        logs += s;
                        allLogs += s;
                    },
                    writeError: (s: string) => {
                        logs += s;
                        allLogs += s;
                    },
                },
            };
            const start = performance.now();
            try {
                run(executableCode, (tc.input || "").trim(), config);
                const elapsed = performance.now() - start;
                const actual = logs.trim();
                const expected = (tc.output || "").trim();
                const passed = actual === expected || normalizeCompare(actual, expected);
                results.push({
                    passed,
                    input: tc.input,
                    expectedOutput: expected,
                    actualOutput: actual || "(no output)",
                    executionTime: elapsed,
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({
                    passed: false,
                    input: tc.input,
                    expectedOutput: tc.output,
                    actualOutput: msg,
                    executionTime: 0,
                });
            }
        }

        self.postMessage({ type: "success", results, logs: allLogs });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: "error", error: message, logs: allLogs });
    }
};

function normalizeCompare(actual: string, expected: string): boolean {
    if (actual === expected) return true;
    try {
        const a = JSON.parse(actual);
        const b = JSON.parse(expected);
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return actual.trim() === expected.trim();
    }
}
