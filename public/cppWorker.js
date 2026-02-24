/**
 * C/C++ Runtime Worker via JSCPP (Classic Worker)
 * DUAL MODE:
 *   1. FREE-FORM mode: Runs entire code with an empty stdin. cout/printf output is captured.
 *   2. PROBLEM mode: Runs code once per test case, feeding preprocessed input via stdin.
 *
 * JSCPP is loaded lazily from local /jscpp.js or CDN fallback.
 */

// Set up module system for Browserify bundles
var fakeModule = { exports: {} };
self.module = fakeModule;
self.exports = fakeModule.exports;

if (typeof self.window === "undefined") self.window = self;
if (typeof self.global === "undefined") self.global = self;

// ─── Helpers ─────────────────────────────────────────────────────────

function normalizeCompare(actual, expected) {
    if (actual === expected) return true;
    try {
        var a = JSON.parse(actual), b = JSON.parse(expected);
        return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
        return actual.trim() === expected.trim();
    }
}

function getRun() {
    var JSCPP = self.JSCPP;
    if (!JSCPP && self.window) JSCPP = self.window.JSCPP;
    if (typeof JSCPP === "function") return JSCPP;
    if (JSCPP && typeof JSCPP.run === "function") return JSCPP.run.bind(JSCPP);
    var modExp = self.module && self.module.exports;
    if (modExp && typeof modExp === "function") return modExp;
    if (modExp && typeof modExp.run === "function") return modExp.run.bind(modExp);
    if (modExp && typeof modExp.default === "function") return modExp.default;
    return null;
}

/**
 * Preprocess LeetCode-format input → whitespace-separated values for JSCPP cin.
 * "nums = [2,7,11,15], target = 9" → "4\n2 7 11 15\n9"
 * "5"  → "5"
 * "" (empty) → "" (free-form, no stdin)
 */
function preprocessCppInput(input) {
    if (!input || !input.trim()) return "";

    var cleaned = input.replace(/[a-zA-Z_]\w*\s*=\s*/g, "").trim();
    var tokens = [], depth = 0, current = "";
    for (var i = 0; i < cleaned.length; i++) {
        var ch = cleaned[i];
        if (ch === "[") { depth++; current += ch; }
        else if (ch === "]") { depth--; current += ch; }
        else if (ch === "," && depth === 0) {
            if (current.trim()) tokens.push(current.trim());
            current = "";
        } else { current += ch; }
    }
    if (current.trim()) tokens.push(current.trim());

    var lines = [];
    for (var j = 0; j < tokens.length; j++) {
        var token = tokens[j].trim();
        if (token.startsWith("[") && token.endsWith("]")) {
            var inner = token.slice(1, -1).trim();
            if (!inner) { lines.push("0"); }
            else {
                var elems = inner.split(",").map(function (s) { return s.trim(); });
                lines.push(String(elems.length));
                lines.push(elems.join(" "));
            }
        } else {
            // Strip surrounding quotes for string values
            if ((token.startsWith('"') && token.endsWith('"')) ||
                (token.startsWith("'") && token.endsWith("'"))) {
                token = token.slice(1, -1);
            }
            lines.push(token);
        }
    }
    return lines.join("\n");
}

// ─── Load JSCPP ───────────────────────────────────────────────────────

function loadJSCPP() {
    var run = null;
    var errors = [];

    try {
        var localPath = self.location.origin + "/jscpp.js";
        console.log("Worker: Loading JSCPP from:", localPath);
        var origDoc = self.document;
        self.document = { _mock: true };
        importScripts(localPath);
        if (origDoc === undefined) delete self.document; else self.document = origDoc;
        run = getRun();
        if (typeof run === "function") { console.log("Worker: JSCPP loaded locally"); return run; }
        errors.push("Local load OK but JSCPP not found in scope");
    } catch (e) {
        errors.push("Local load failed: " + (e.message || e));
    }

    try {
        var cdnUrl = "https://cdn.jsdelivr.net/gh/felixhao28/JSCPP@gh-pages/dist/JSCPP.es5.min.js";
        console.log("Worker: Loading JSCPP from CDN:", cdnUrl);
        var origDocCdn = self.document;
        self.document = { _mock: true };
        importScripts(cdnUrl);
        if (origDocCdn === undefined) delete self.document; else self.document = origDocCdn;
        run = getRun();
        if (typeof run === "function") { console.log("Worker: JSCPP loaded from CDN"); return run; }
        errors.push("CDN load OK but JSCPP not found in scope");
    } catch (cdnErr) {
        errors.push("CDN load failed: " + (cdnErr.message || cdnErr));
    }

    throw new Error("Failed to load JSCPP. Errors: " + errors.join("; "));
}

// ─── Execute Code ─────────────────────────────────────────────────────

function execCode(code, inputStr, run) {
    var output = "";
    var config = {
        stdio: {
            write: function (s) { output += s; },
            writeError: function (s) { output += s; }
        }
    };

    // Ensure there's a main() — if not, wrap so JSCPP can run
    var hasMain = /int\s+main\s*\(/.test(code);
    var executableCode = hasMain
        ? code
        : code + "\nint main() { return 0; }\n";

    run(executableCode, inputStr, config);
    return output;
}

// ─── Main Message Handler ─────────────────────────────────────────────

self.onmessage = function (e) {
    var code = e.data.code;
    var testCases = e.data.testCases || [];

    try {
        var run = getRun();
        if (typeof run !== "function") run = loadJSCPP();

        var hasMain = /int\s+main\s*\(/.test(code);
        var hasTestCases = testCases.length > 0;
        var looksLikeProblem = /cin\s*>>/.test(code) || /scanf\s*\(/.test(code);

        if (hasTestCases && hasMain && looksLikeProblem) {
            // ─── PROBLEM MODE ─────────────────────────────────────────
            var results = [];
            var allLogs = "";

            for (var i = 0; i < testCases.length; i++) {
                var tc = testCases[i];
                var rawInput = (tc.input || "").trim();
                var processedInput = preprocessCppInput(rawInput);
                var start = performance.now();

                try {
                    var output = execCode(code, processedInput, run);
                    var elapsed = performance.now() - start;
                    var actual = output.trim();
                    var expected = (tc.output || "").trim();
                    allLogs += actual + "\n";
                    results.push({
                        passed: actual === expected || normalizeCompare(actual, expected),
                        input: tc.input,
                        expectedOutput: expected,
                        actualOutput: actual || "(no output)",
                        executionTime: elapsed
                    });
                } catch (err) {
                    throw err; // Bubble up to top-level error handler
                }
            }

            self.postMessage({ type: "success", results: results, logs: allLogs.trim() });

        } else {
            // ─── FREE-FORM MODE ───────────────────────────────────────
            // Run with empty stdin — code should use hardcoded values or no input
            var start = performance.now();
            var output = execCode(code, "", run);
            var elapsed = performance.now() - start;
            var consoleOut = output.trim() || "(no output — try adding cout << \"hello\" or printf())";

            self.postMessage({
                type: "success",
                results: [{
                    passed: true,
                    input: "(free-form)",
                    expectedOutput: "",
                    actualOutput: consoleOut,
                    executionTime: Math.round(elapsed)
                }],
                logs: output,
                freeForm: true
            });
        }

    } catch (err) {
        var message = err && err.message ? err.message : String(err);
        self.postMessage({ type: "error", error: message, logs: "" });
    }
};
