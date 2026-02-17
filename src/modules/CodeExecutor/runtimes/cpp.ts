/**
 * C/C++ runtime using JSCPP — a pure JavaScript C++ interpreter.
 * Runs entirely in the browser with no backend needed.
 *
 * JSCPP supports a subset of C++ (C99/C++11 basics): iostream, cstdio, cstring,
 * cmath, cctype, cstdlib, ctime, iomanip — basic types, arrays, pointers, structs.
 * Does NOT support STL containers (vector, map, set, etc.) or templates.
 *
 * Input/Output model: stdin (cin) → stdout (cout), like competitive programming.
 */
import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";
// @ts-ignore
import _ from "lodash";

// Dynamic import of JSCPP (loaded on first use)
// We store the ENTIRE module object so that calling module.run() preserves
// the `this` context — JSCPP's run() uses `this.includes` internally.
let jscppModule: JscppObj | null = null;
let jscppLoadPromise: Promise<void> | null = null;

interface JscppObj {
    run: (code: string, input: string, config?: JscppConfig) => number;
    includes: Record<string, unknown>;
}

interface JscppConfig {
    stdio?: {
        write?: (s: string) => void;
    };
    includes?: Record<string, unknown>;
}

/**
 * Lazily load JSCPP from the npm package.
 * Uses dynamic import so it's only fetched when C++ is first used.
 */
function loadJSCPP(): Promise<void> {
    if (jscppModule) return Promise.resolve();
    if (jscppLoadPromise) return jscppLoadPromise;

    jscppLoadPromise = (async () => {
        try {
            logger.info("Loading JSCPP module...");

            logger.info("Loading JSCPP module...");

            // Inject lodash globally for JSCPP's defaults.js patch
            if (typeof window !== "undefined") {
                // @ts-ignore
                (window as any)._ = _;
            }

            // JSCPP is a CommonJS module; Vite handles CJS-to-ESM transform
            const mod = await import("JSCPP");
            // Vite may wrap the CJS export in `.default`
            const raw = mod.default || mod;

            // Unwrap nested .default if present (double-default CJS wrapper)
            const JSCPP = raw?.default && typeof raw.default === "object" ? raw.default : raw;

            if (typeof JSCPP === "object" && typeof JSCPP.run === "function" && JSCPP.includes) {
                jscppModule = JSCPP as JscppObj;
                logger.info("JSCPP loaded successfully", {
                    keys: Object.keys(JSCPP).join(","),
                    includesKeys: Object.keys(JSCPP.includes).join(","),
                });
                return;
            }

            // Fallback: check if run exists without includes (bind manually)
            if (typeof JSCPP === "object" && typeof JSCPP.run === "function") {
                jscppModule = JSCPP as JscppObj;
                logger.warn("JSCPP loaded but 'includes' not found on module — may need explicit passing");
                return;
            }

            throw new Error(
                `JSCPP loaded but .run not found. typeof: ${typeof JSCPP}, keys: ${typeof JSCPP === "object" ? Object.keys(JSCPP).join(",") : "N/A"
                }`
            );
        } catch (err) {
            jscppLoadPromise = null; // Allow retry on next attempt
            const msg = err instanceof Error ? err.message : String(err);
            logger.error("Failed to load JSCPP", msg);
            throw new Error("Failed to load C++ interpreter: " + msg);
        }
    })();

    return jscppLoadPromise;
}

/**
 * Convert LeetCode-style test case input into stdin-compatible text.
 *
 * E.g. "nums = [2,7,11,15], target = 9"
 *  → removes "name = " prefixes
 *  → converts arrays [2,7,11,15] into "4\n2 7 11 15"
 *  → leaves plain numbers as-is
 *
 * This way user code can read via cin: first the array length, then elements.
 */
function testInputToStdin(input: string): string {
    if (!input || !input.trim()) return "";

    // Remove variable assignments like "nums = " or "target = "
    const cleaned = input.replace(/[a-zA-Z_]\w*\s*=\s*/g, "");

    const parts: string[] = [];

    // Parse comma-separated values, handling nested arrays
    let depth = 0;
    let current = "";
    for (const ch of cleaned) {
        if (ch === "[") {
            depth++;
            if (depth === 1) {
                current = "";
                continue;
            }
        }
        if (ch === "]") {
            depth--;
            if (depth === 0) {
                // End of array: emit length then elements
                const elements = current
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                parts.push(String(elements.length));
                parts.push(elements.join(" "));
                current = "";
                continue;
            }
        }
        if (ch === "," && depth === 0) {
            const val = current.trim();
            if (val) parts.push(val);
            current = "";
            continue;
        }
        current += ch;
    }
    const remaining = current.trim();
    if (remaining) parts.push(remaining);

    return parts.join("\n");
}

function normalizeCompare(actual: string, expected: string): boolean {
    if (actual === expected) return true;
    // Try JSON-based comparison (handles array formatting differences)
    try {
        const a = JSON.parse(actual);
        const b = JSON.parse(expected);
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        // Whitespace-insensitive comparison
        return actual.trim().replace(/\s+/g, " ") === expected.trim().replace(/\s+/g, " ");
    }
}

/**
 * Execute C++ code against test cases using JSCPP interpreter.
 * Input is fed via stdin (JSCPP's second parameter).
 */
function executeCpp(code: string, testCases: TestCase[]): ExecutionResult {

    const results: {
        passed: boolean;
        input: string;
        expectedOutput: string;
        actualOutput: string;
        executionTime: number;
    }[] = [];
    let allLogs = "";

    for (const tc of testCases) {
        let output = "";
        const config: JscppConfig = {
            stdio: {
                write: (s: string) => {
                    output += s;
                    allLogs += s;
                },
            },
        };

        const stdinInput = testInputToStdin(tc.input);
        logger.debug("Running test case", {
            input: tc.input,
            stdinInput,
            expected: tc.output,
        });

        const start = performance.now();
        try {
            // CRITICAL: Call run as a method on jscppModule so that
            // `this.includes` inside JSCPP's run() resolves correctly.
            // Vite's CJS-to-ESM conversion breaks `this` binding if we
            // destructure `run` from the module.
            jscppModule!.run(code, stdinInput, config);
            const elapsed = performance.now() - start;
            const actual = output.trim();
            const expected = (tc.output || "").trim();
            const passed = normalizeCompare(actual, expected);
            results.push({
                passed,
                input: tc.input,
                expectedOutput: expected,
                actualOutput: actual || "(no output)",
                executionTime: elapsed,
            });
        } catch (err: unknown) {
            const elapsed = performance.now() - start;
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn("JSCPP runtime error for test case", { input: tc.input, error: msg });
            results.push({
                passed: false,
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: "Error: " + msg,
                executionTime: elapsed,
            });
        }
    }

    const allPassed = results.length > 0 && results.every((r) => r.passed);
    const totalTime = results.reduce((acc, r) => acc + r.executionTime, 0);

    return {
        status: allPassed ? "Accepted" : "Wrong Answer",
        output: allLogs || "(no output)",
        executionTime: totalTime,
        testCaseResults: results,
    } as ExecutionResult;
}

/**
 * Run C/C++ code using JSCPP interpreter (pure web, no backend needed).
 */
export const runCpp = async (
    code: string,
    testCases: TestCase[]
): Promise<ExecutionResult> => {
    logger.info("C++ execution started", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    try {
        // Load JSCPP if not already loaded
        await loadJSCPP();

        // Execute on main thread (JSCPP is lightweight and fast for DSA problems)
        const result = executeCpp(code, testCases);
        logger.info("C++ Execution Complete", {
            status: result.status,
            testResults: result.testCaseResults?.length,
        });
        return result;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("C++ Runtime Error", message);
        return {
            status: "Runtime Error",
            output: message,
            executionTime: 0,
        } as ExecutionResult;
    }
};
