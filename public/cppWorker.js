/**
 * C/C++ runtime via JSCPP (classic worker).
 * Uses CDN JSCPP directly (like pyodideWorker.js does) for reliability.
 * JSCPP is loaded lazily on first message so the worker becomes ready immediately.
 */
// Set up module system for Browserify bundles
var fakeModule = { exports: {} };
self.module = fakeModule;
self.exports = fakeModule.exports;

// Browserify bundles set window.JSCPP - create window alias for worker context
if (typeof self.window === "undefined") {
    self.window = self;
}
if (typeof self.global === "undefined") {
    self.global = self;
}

function normalizeCompare(actual, expected) {
    if (actual === expected) return true;
    try {
        var a = JSON.parse(actual);
        var b = JSON.parse(expected);
        return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
        return actual.trim() === expected.trim();
    }
}

function getRun() {
    // JSCPP CDN sets window.JSCPP, and window is aliased to self
    // Check multiple locations where JSCPP might be
    // IMPORTANT: Return bound functions to preserve `this` context.

    // 1. Check self.JSCPP (set via window.JSCPP = self.JSCPP)
    var JSCPP = self.JSCPP;

    // 2. Check window.JSCPP (in case alias didn't work)
    if (!JSCPP && self.window) {
        JSCPP = self.window.JSCPP;
    }

    // 3. If JSCPP is a function, use it directly (it IS the run function)
    if (typeof JSCPP === "function") {
        return JSCPP;
    }

    // 4. Check for .run property — bind to preserve context
    if (JSCPP && typeof JSCPP.run === "function") {
        return JSCPP.run.bind(JSCPP);
    }

    // 5. Check module.exports
    var modExp = self.module && self.module.exports;
    if (modExp && typeof modExp === "function") {
        return modExp;
    }
    if (modExp && typeof modExp.run === "function") {
        return modExp.run.bind(modExp);
    }
    if (modExp && typeof modExp.default === "function") {
        return modExp.default;
    }

    return null;
}

/**
 * Preprocess LeetCode-format input into simple whitespace-separated values for JSCPP's cin.
 * "nums = [2,7,11,15], target = 9" → "4\n2 7 11 15\n9"
 * "5" → "5"
 * "[1,2,3]" → "3\n1 2 3"
 */
function preprocessCppInput(input) {
    if (!input || !input.trim()) return "";

    // Strip variable names: "nums = [2,7], target = 9" → "[2,7], 9"
    var cleaned = input.replace(/[a-zA-Z_]\w*\s*=\s*/g, "").trim();

    // Tokenize: split into individual values (arrays, numbers, strings)
    var tokens = [];
    var depth = 0, current = "";
    for (var i = 0; i < cleaned.length; i++) {
        var ch = cleaned[i];
        if (ch === "[") {
            depth++;
            current += ch;
        } else if (ch === "]") {
            depth--;
            current += ch;
        } else if (ch === "," && depth === 0) {
            if (current.trim()) tokens.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim()) tokens.push(current.trim());

    // Convert each token to JSCPP-friendly format
    var lines = [];
    for (var j = 0; j < tokens.length; j++) {
        var token = tokens[j].trim();
        if (token.startsWith("[") && token.endsWith("]")) {
            // Array: "[2,7,11,15]" → "4\n2 7 11 15"
            var inner = token.slice(1, -1).trim();
            if (!inner) {
                lines.push("0"); // empty array → length 0
            } else {
                var elems = inner.split(",").map(function (s) { return s.trim(); });
                lines.push(String(elems.length));
                lines.push(elems.join(" "));
            }
        } else {
            // Single value
            lines.push(token);
        }
    }

    return lines.join("\n");
}

function runCode(code, testCases, runFunc) {
    // Use provided run function or get it
    var run = runFunc || getRun();
    if (typeof run !== "function") {
        throw new Error("JSCPP.run not found. JSCPP type: " + typeof self.JSCPP + ", module.exports type: " + typeof (self.module && self.module.exports));
    }
    var hasMain = /int\s+main\s*\(/.test(code);
    var executableCode = hasMain
        ? code
        : code + "\n#include <iostream>\nint main() { std::cout << \"Add int main() to run your program.\"; return 0; }\n";
    var results = [];
    var allLogs = "";
    for (var i = 0; i < testCases.length; i++) {
        var tc = testCases[i];
        var logs = "";
        var config = {
            stdio: {
                write: function (s) { logs += s; allLogs += s; },
                writeError: function (s) { logs += s; allLogs += s; }
            }
        };

        // Preprocess input: convert LeetCode format to JSCPP-friendly format
        // "nums = [2,7,11,15], target = 9" → "4\n2 7 11 15\n9"
        var rawInput = (tc.input || "").trim();
        var processedInput = preprocessCppInput(rawInput);

        var start = performance.now();
        try {
            run(executableCode, processedInput, config);
            var elapsed = performance.now() - start;
            var actual = logs.trim();
            var expected = (tc.output || "").trim();
            var passed = actual === expected || normalizeCompare(actual, expected);
            results.push({
                passed: passed,
                input: tc.input,
                expectedOutput: expected,
                actualOutput: actual || "(no output)",
                executionTime: elapsed
            });
        } catch (err) {
            var msg = err && err.message ? err.message : String(err);
            results.push({
                passed: false,
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: msg,
                executionTime: 0
            });
        }
    }
    return { results: results, logs: allLogs };
}

// Load JSCPP synchronously (importScripts is synchronous)
function loadJSCPP() {
    var run = null;
    var errors = [];

    // 1. Try local jscpp.js first (explicit origin)
    try {
        var localPath = self.location.origin + "/jscpp.js";
        console.log("Worker: Attempting to load JSCPP from:", localPath);

        // CRITICAL FIX: Mock document to force JSCPP into "global export" mode 
        // instead of "worker service" mode (which would overwrite our onmessage).
        var originalDocument = self.document;
        self.document = { _mock: true };

        importScripts(localPath);

        // Restore document
        if (originalDocument === undefined) delete self.document;
        else self.document = originalDocument;

        run = getRun();
        if (typeof run === "function") {
            console.log("Worker: JSCPP loaded from local path");
            return run;
        }
        errors.push("Local load successful but JSCPP not found in global scope");
    } catch (e) {
        errors.push("Local load failed: " + (e.message || e));
    }

    // 2. Fallback to CDN
    const cdnUrl = "https://cdn.jsdelivr.net/gh/felixhao28/JSCPP@gh-pages/dist/JSCPP.es5.min.js";
    try {
        console.log("Worker: Attempting to load JSCPP from CDN:", cdnUrl);

        // Same mock for CDN
        var originalDocumentCdn = self.document;
        self.document = { _mock: true };

        importScripts(cdnUrl);

        if (originalDocumentCdn === undefined) delete self.document;
        else self.document = originalDocumentCdn;

        run = getRun();
        if (typeof run === "function") {
            console.log("Worker: JSCPP loaded from CDN");
            return run;
        }
        errors.push("CDN load successful but JSCPP not found in global scope");
    } catch (cdnErr) {
        errors.push("CDN load failed: " + (cdnErr.message || cdnErr));
    }

    throw new Error("Failed to load JSCPP. Errors: " + errors.join("; "));
}

self.onmessage = function (e) {
    var code = e.data.code;
    var testCases = e.data.testCases || [];
    var allLogs = "";

    try {
        // Check if JSCPP is already loaded
        var run = getRun();

        // If not loaded, load it now (synchronously)
        if (typeof run !== "function") {
            run = loadJSCPP();
        }

        // Execute code
        var out = runCode(code, testCases, run);
        self.postMessage({ type: "success", results: out.results, logs: out.logs });
    } catch (err) {
        var message = err && err.message ? err.message : String(err);
        self.postMessage({ type: "error", error: message, logs: allLogs });
    }
};
