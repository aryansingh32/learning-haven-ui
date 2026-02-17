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
    
    // 1. Check self.JSCPP (set via window.JSCPP = self.JSCPP)
    var JSCPP = self.JSCPP;
    
    // 2. Check window.JSCPP (in case alias didn't work)
    if (!JSCPP && self.window) {
        JSCPP = self.window.JSCPP;
    }
    
    // 3. If JSCPP is a function, use it directly
    if (typeof JSCPP === "function") {
        return JSCPP;
    }
    
    // 4. Check for .run property
    if (JSCPP && typeof JSCPP.run === "function") {
        return JSCPP.run;
    }
    
    // 5. Check module.exports
    var modExp = self.module && self.module.exports;
    if (modExp && typeof modExp === "function") {
        return modExp;
    }
    if (modExp && typeof modExp.run === "function") {
        return modExp.run;
    }
    if (modExp && typeof modExp.default === "function") {
        return modExp.default;
    }
    
    return null;
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
        var start = performance.now();
        try {
            run(executableCode, (tc.input || "").trim(), config);
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
    
    // Try local jscpp.js first
    try {
        importScripts("/jscpp.js");
        run = getRun();
        if (typeof run === "function") {
            return run;
        }
    } catch (e) {
        // Local failed to load, will try CDN below
    }
    
    // Fallback to CDN (known to work, like pyodideWorker.js)
    try {
        importScripts("https://cdn.jsdelivr.net/gh/felixhao28/JSCPP@gh-pages/dist/JSCPP.es5.min.js");
        run = getRun();
        if (typeof run === "function") {
            return run;
        }
        // CDN loaded but run function not found
        throw new Error("JSCPP loaded from CDN but run function not found. JSCPP type: " + typeof self.JSCPP + ", window.JSCPP: " + typeof (self.window && self.window.JSCPP));
    } catch (cdnErr) {
        // Check if it's our error about run function not found
        if (cdnErr.message && cdnErr.message.indexOf("run function not found") !== -1) {
            throw cdnErr;
        }
        // CDN failed to load
        throw new Error("Failed to load JSCPP from both local and CDN. CDN error: " + (cdnErr.message || cdnErr));
    }
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
