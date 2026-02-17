/**
 * Compile C/C++ source to WebAssembly using twr-wasm toolchain.
 * Supports both backend API and future in-browser compilation.
 */
import { logger } from "../logger";

export interface CompileOptions {
    /** Compiler API endpoint (e.g., '/api/compile' or Compiler Explorer API) */
    apiUrl?: string;
    /** Use Compiler Explorer API (public, no backend needed) */
    useCompilerExplorer?: boolean;
}

/**
 * Compile C/C++ source to WASM bytes.
 * Returns null if compilation fails or is unavailable.
 */
export async function compileCppToWasm(
    code: string,
    language: "cpp" | "c" = "cpp",
    options: CompileOptions = {}
): Promise<ArrayBuffer | null> {
    const { apiUrl, useCompilerExplorer = false } = options;

    // Option 1: Use Compiler Explorer API (public, no backend needed)
    if (useCompilerExplorer) {
        try {
            logger.info("Compiling via Compiler Explorer API");
            const response = await fetch("https://godbolt.org/api/compiler/clang_trunk/compile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source: code,
                    options: {
                        userArguments: `--target=wasm32 -nostdinc -nostdlib -O2`,
                        compilerOptions: {},
                        filters: {
                            binary: true,
                            binaryObject: false,
                            execute: false,
                            intel: false,
                            labels: false,
                            libraryCode: false,
                            directives: true,
                            commentOnly: true,
                            trim: false,
                        },
                    },
                }),
            });

            if (!response.ok) {
                logger.warn("Compiler Explorer API failed", { status: response.status });
                return null;
            }

            const result = await response.json();
            // Compiler Explorer returns binary in base64 or hex
            // Note: This is a simplified example - actual CE API may differ
            if (result.asm && Array.isArray(result.asm)) {
                // For now, return null - CE doesn't directly output WASM
                // We'd need to use a different endpoint or compile service
                logger.warn("Compiler Explorer doesn't directly output WASM");
                return null;
            }
        } catch (err) {
            logger.warn("Compiler Explorer API error", err);
            return null;
        }
    }

    // Option 2: Use custom backend API
    if (apiUrl) {
        try {
            logger.info("Compiling via backend API", { apiUrl, codeLength: code.length });
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, language }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                logger.warn("Backend compile API failed", { 
                    status: response.status, 
                    statusText: response.statusText,
                    error: errorText 
                });
                return null;
            }

            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                // API returned JSON error instead of WASM
                const errorData = await response.json();
                logger.warn("Backend compile API returned error", errorData);
                return null;
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            
            if (arrayBuffer.byteLength === 0) {
                logger.warn("Backend compile API returned empty response");
                return null;
            }
            
            logger.info("✅ WASM compilation successful", { size: arrayBuffer.byteLength });
            return arrayBuffer;
        } catch (err) {
            logger.warn("Backend compile API error", { 
                error: err instanceof Error ? err.message : String(err),
                apiUrl 
            });
            return null;
        }
    }

    // Option 3: Future: In-browser compiler (e.g., Wasmer clang-wasm)
    // This would require loading a WASM-compiled clang, which is large
    // For now, return null to fall back to JSCPP

    return null;
}

/**
 * Check if WASM compilation is available (has API configured or in-browser compiler loaded).
 */
export function isWasmCompilationAvailable(options: CompileOptions = {}): boolean {
    return !!(options.apiUrl || options.useCompilerExplorer);
}
