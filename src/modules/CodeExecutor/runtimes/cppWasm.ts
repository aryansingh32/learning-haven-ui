/**
 * Run pre-compiled C/C++ WebAssembly using twr-wasm runtime.
 * Use this when you have WASM bytes (e.g. from a compile API or future in-browser clang).
 * The WASM must be built with twr-wasm's lib-c (twr.a) and export "main" (e.g. wasm-ld --export=main).
 */
import { twrWasmModule } from "twr-wasm";
import { TwrBufferConsole } from "./twrBufferConsole";
import type { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

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

/**
 * Run pre-compiled C/C++ WASM with the given test cases.
 * WASM must be compiled and linked with twr-wasm (e.g. clang + wasm-ld + twr.a, --export=main).
 */
export async function runCppViaWasm(
    wasmBytes: ArrayBuffer,
    testCases: TestCase[],
    entryPoint = "main"
): Promise<ExecutionResult> {
    if (typeof document === "undefined") {
        return {
            status: "Runtime Error",
            output: "WASM runtime requires a browser environment",
            executionTime: 0,
        };
    }

    const bufferCon = new TwrBufferConsole();
    const io = { stdio: bufferCon, stderr: bufferCon };
    let url: string | null = null;

    try {
        url = URL.createObjectURL(new Blob([wasmBytes], { type: "application/wasm" }));
        const mod = new twrWasmModule({ stdio: bufferCon, io });

        await mod.loadWasm(url);

        const results: Array<{
            passed: boolean;
            input: string;
            expectedOutput: string;
            actualOutput: string;
            executionTime: number;
        }> = [];
        let allLogs = "";

        for (const tc of testCases) {
            bufferCon.reset();
            bufferCon.setInput((tc.input ?? "").trim());

            const start = performance.now();
            try {
                if (typeof (mod.exports as Record<string, unknown>)[entryPoint] !== "function") {
                    throw new Error(`WASM module does not export "${entryPoint}". Link with e.g. wasm-ld --export=${entryPoint}.`);
                }
                (mod.callC as (params: [string, ...unknown[]]) => number)([entryPoint]);
                const elapsed = performance.now() - start;
                const actual = bufferCon.getOutput().trim();
                const expected = (tc.output ?? "").trim();
                const passed = actual === expected || normalizeCompare(actual, expected);
                results.push({
                    passed,
                    input: tc.input ?? "",
                    expectedOutput: expected,
                    actualOutput: actual || "(no output)",
                    executionTime: elapsed,
                });
                allLogs += actual + (actual ? "\n" : "");
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({
                    passed: false,
                    input: tc.input ?? "",
                    expectedOutput: tc.output ?? "",
                    actualOutput: msg,
                    executionTime: 0,
                });
                allLogs += msg + "\n";
            }
        }

        const allPassed = results.length > 0 && results.every((r) => r.passed);
        const totalTime = results.reduce((acc, r) => acc + r.executionTime, 0);
        logger.info("C++ WASM execution finished", { passed: allPassed });

        return {
            status: allPassed ? "Accepted" : "Wrong Answer",
            output: allLogs,
            executionTime: totalTime,
            testCaseResults: results,
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("C++ WASM runtime error", message);
        return {
            status: "Runtime Error",
            output: message,
            executionTime: 0,
        };
    } finally {
        if (url) URL.revokeObjectURL(url);
    }
}
