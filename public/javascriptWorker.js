/**
 * JavaScript Runtime Worker (Classic Worker)
 * SaaS-grade: Supports ANY problem, not just Two Sum.
 * 
 * Function detection priority:
 *   1. Explicit `functionName` from message payload
 *   2. Solution class — auto-detects the first non-constructor method
 *   3. Last standalone function defined in the code
 *   4. Common names: solve, solution, main
 */

// ─── Comparison Utilities ───────────────────────────────────────────
function normalizeAndCompare(actual, expected) {
    if (actual === expected) return true;
    // Try deep JSON comparison (handles [0,1] vs [0, 1])
    try {
        var a = JSON.parse(actual);
        var b = JSON.parse(expected);
        return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
        return actual.trim() === expected.trim();
    }
}

// ─── Input Parsing ──────────────────────────────────────────────────
/**
 * Parse LeetCode-style input strings into function arguments.
 * Supports formats like:
 *   "nums = [2,7,11,15], target = 9"
 *   "[2,7,11,15], 9"
 *   "hello"
 *   "5"
 */
function parseInput(inputStr) {
    if (!inputStr || !inputStr.trim()) return [];

    // Strip variable names: "nums = [2,7], target = 9" → "[2,7], 9"
    var cleaned = inputStr.replace(/[a-zA-Z_]\w*\s*=\s*/g, "");
    cleaned = cleaned.trim();

    // Try parsing as a JSON array wrapper
    try {
        return JSON.parse("[" + cleaned + "]");
    } catch (e) {
        // Fallback: try individual values
        try {
            var parts = [];
            // Smart split: respect brackets and quotes
            var depth = 0, inStr = false, current = "", strChar = "";
            for (var i = 0; i < cleaned.length; i++) {
                var ch = cleaned[i];
                if (inStr) {
                    current += ch;
                    if (ch === strChar && cleaned[i - 1] !== "\\") inStr = false;
                } else if (ch === '"' || ch === "'") {
                    inStr = true;
                    strChar = ch;
                    current += ch;
                } else if (ch === "[" || ch === "{" || ch === "(") {
                    depth++;
                    current += ch;
                } else if (ch === "]" || ch === "}" || ch === ")") {
                    depth--;
                    current += ch;
                } else if (ch === "," && depth === 0) {
                    parts.push(current.trim());
                    current = "";
                } else {
                    current += ch;
                }
            }
            if (current.trim()) parts.push(current.trim());

            return parts.map(function (p) {
                try { return JSON.parse(p); } catch (e2) { return p; }
            });
        } catch (e3) {
            return [cleaned];
        }
    }
}

// ─── Function Detection ─────────────────────────────────────────────
/**
 * Detect the user's target function from evaluated code.
 * Returns the callable function or throws an error.
 */
function detectFunction(code, hintName) {
    // Strategy: Evaluate code, then find the function to call.
    // The Function constructor creates a new scope, so we use
    // a self-executing wrapper that returns the detected function.

    // 1. Extract all function names from the code
    var funcNameMatches = code.match(/(?:function\s+|(?:var|let|const)\s+)([a-zA-Z_$]\w*)\s*(?:=\s*function|\s*\()/g) || [];
    var definedNames = funcNameMatches.map(function (m) {
        var match = m.match(/(?:function\s+|(?:var|let|const)\s+)([a-zA-Z_$]\w*)/);
        return match ? match[1] : null;
    }).filter(Boolean);

    // 2. Build detection script
    var detectionParts = [];

    // Priority 1: Explicit hint name
    if (hintName) {
        detectionParts.push(
            "if (typeof " + hintName + " === 'function') return " + hintName + ";"
        );
    }

    // Priority 2: Solution class (any method)
    detectionParts.push(
        "if (typeof Solution !== 'undefined') {",
        "    var sol = new Solution();",
        "    var methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sol))",
        "        .filter(function(m) { return m !== 'constructor' && typeof sol[m] === 'function'; });",
        "    if (methods.length > 0) return sol[methods[0]].bind(sol);",
        "}"
    );

    // Priority 3: Last defined function in user code (most likely the answer)
    for (var i = definedNames.length - 1; i >= 0; i--) {
        detectionParts.push(
            "if (typeof " + definedNames[i] + " === 'function') return " + definedNames[i] + ";"
        );
    }

    // Priority 4: Common names
    var commonNames = ["solve", "solution", "main", "run", "calculate", "compute",
        "maxProfit", "minCost", "findMedian", "isValid", "longestSubstring",
        "reverseList", "mergeTwoLists", "hasCycle", "levelOrder"];
    commonNames.forEach(function (name) {
        if (definedNames.indexOf(name) === -1) {
            detectionParts.push(
                "if (typeof " + name + " === 'function') return " + name + ";"
            );
        }
    });

    detectionParts.push(
        "throw new Error('No executable function found. Define a function or a Solution class.');"
    );

    var fullScript = code + "\n" + detectionParts.join("\n");

    try {
        return new Function(fullScript)();
    } catch (err) {
        if (err.message && err.message.indexOf("No executable function") !== -1) {
            throw err;
        }
        throw new Error("Compilation Error: " + (err.message || err));
    }
}

// ─── Main Message Handler ───────────────────────────────────────────
self.onmessage = function (e) {
    var code = e.data.code;
    var testCases = e.data.testCases || [];
    var functionName = e.data.functionName || null; // Optional hint
    var results = [];
    var allLogs = "";

    // Intercept console.log and console.error
    var logBuffer = [];
    var originalLog = console.log;
    var originalError = console.error;
    var originalWarn = console.warn;

    console.log = function () {
        var args = Array.prototype.slice.call(arguments);
        var line = args.map(function (a) { return String(a); }).join(" ");
        logBuffer.push(line);
        allLogs += line + "\n";
    };
    console.error = function () {
        var args = Array.prototype.slice.call(arguments);
        var line = "[ERROR] " + args.map(function (a) { return String(a); }).join(" ");
        logBuffer.push(line);
        allLogs += line + "\n";
    };
    console.warn = function () {
        var args = Array.prototype.slice.call(arguments);
        var line = "[WARN] " + args.map(function (a) { return String(a); }).join(" ");
        logBuffer.push(line);
        allLogs += line + "\n";
    };

    try {
        // Detect user function
        var userFunction = detectFunction(code, functionName);

        if (typeof userFunction !== "function") {
            throw new Error("No executable function found in your code. Please define a function or Solution class.");
        }

        // Run test cases
        for (var i = 0; i < testCases.length; i++) {
            var tc = testCases[i];
            var start = performance.now();
            var args = [];

            try {
                args = parseInput(tc.input);
            } catch (parseErr) {
                results.push({
                    passed: false,
                    input: tc.input,
                    expectedOutput: tc.output,
                    actualOutput: "Input Parse Error: " + parseErr.message,
                    executionTime: 0
                });
                continue;
            }

            try {
                var actual = userFunction.apply(null, args);
                var elapsed = performance.now() - start;
                var actualStr = (actual !== undefined && actual !== null)
                    ? JSON.stringify(actual)
                    : String(actual);
                var expectedStr = (tc.output || "").trim();

                var passed = normalizeAndCompare(actualStr, expectedStr);

                results.push({
                    passed: passed,
                    input: tc.input,
                    expectedOutput: expectedStr,
                    actualOutput: actualStr,
                    executionTime: elapsed
                });
            } catch (runErr) {
                results.push({
                    passed: false,
                    input: tc.input,
                    expectedOutput: tc.output,
                    actualOutput: "Runtime Error: " + runErr.message,
                    executionTime: performance.now() - start
                });
            }
        }

        self.postMessage({
            type: "success",
            results: results,
            logs: allLogs
        });

    } catch (err) {
        self.postMessage({
            type: "error",
            error: err.message || String(err),
            logs: allLogs
        });
    } finally {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
    }
};
