/**
 * JavaScript Runtime Worker (Classic Worker)
 * DUAL MODE:
 *   1. FREE-FORM: No test cases → runs code as-is, console.log output shown.
 *   2. PROBLEM: Has test cases + detects a function/Solution class → calls it per test case.
 *
 * Critical fix: code is never executed more than once.
 */

// ─── Utilities ──────────────────────────────────────────────────────────────

function stringify(val) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return val;
    try { return JSON.stringify(val); } catch (e) { return String(val); }
}

function normalizeAndCompare(actual, expected) {
    if (actual === expected) return true;
    try {
        return JSON.stringify(JSON.parse(actual)) === JSON.stringify(JSON.parse(expected));
    } catch (e) {
        return actual.trim() === expected.trim();
    }
}

function parseInput(inputStr) {
    if (!inputStr || !inputStr.trim()) return [];
    var cleaned = inputStr.replace(/[a-zA-Z_]\w*\s*=\s*/g, '').trim();
    try { return JSON.parse('[' + cleaned + ']'); } catch (e) { }
    try {
        var parts = [], depth = 0, current = '', inStr = false, strChar = '';
        for (var i = 0; i < cleaned.length; i++) {
            var ch = cleaned[i];
            if (inStr) { current += ch; if (ch === strChar && cleaned[i - 1] !== '\\') inStr = false; }
            else if (ch === '"' || ch === "'") { inStr = true; strChar = ch; current += ch; }
            else if (ch === '[' || ch === '{' || ch === '(') { depth++; current += ch; }
            else if (ch === ']' || ch === '}' || ch === ')') { depth--; current += ch; }
            else if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
            else { current += ch; }
        }
        if (current.trim()) parts.push(current.trim());
        return parts.map(function (p) { try { return JSON.parse(p); } catch (e) { return p; } });
    } catch (e) { return [cleaned]; }
}

// ─── Console Capture ────────────────────────────────────────────────────────

function setupConsoleCapture() {
    var allLogs = '';
    var orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
    function capture(prefix) {
        return function () {
            var line = Array.prototype.slice.call(arguments).map(function (a) {
                if (a === null) return 'null';
                if (a === undefined) return 'undefined';
                if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
                return String(a);
            }).join(' ');
            allLogs += (prefix || '') + line + '\n';
        };
    }
    console.log = capture('');
    console.info = capture('[INFO] ');
    console.warn = capture('[WARN] ');
    console.error = capture('[ERROR] ');
    return {
        restore: function () { Object.assign(console, orig); },
        getLogs: function () { return allLogs; }
    };
}

// ─── Function Detection (does NOT execute code — uses static analysis only) ──

function extractFunctionNames(code) {
    var names = [];
    // Match: function foo(, var/let/const foo = function, var/let/const foo = (
    var re = /(?:function\s+([a-zA-Z_$]\w*)\s*\()|(?:(?:var|let|const)\s+([a-zA-Z_$]\w*)\s*=\s*(?:function|\())/g;
    var m;
    while ((m = re.exec(code)) !== null) {
        names.push(m[1] || m[2]);
    }
    return names;
}

function hasSolutionClass(code) {
    return /class\s+Solution\s*\{/.test(code);
}

function hasTopLevelStatements(code) {
    // Check if code has top-level statements (not just function/class definitions)
    var stripped = code
        .replace(/\/\/[^\n]*/g, '')           // remove // comments
        .replace(/\/\*[\s\S]*?\*\//g, '')     // remove /* */ comments
        .replace(/^\s*(function\s+\w+|class\s+\w+|var\s+\w+\s*=\s*function)/gm, ''); // remove func decls
    return /^\s*[^{}()\s]/m.test(stripped);
}

// ─── Execute code ONCE, return { func, logs } ──────────────────────

function executeCodeOnce(code, cap) {
    var funcNames = extractFunctionNames(code);
    var hasSol = hasSolutionClass(code);

    // Build a runner that executes code and extracts the function
    var detectionParts = [];

    if (hasSol) {
        detectionParts.push(
            'if (typeof Solution !== "undefined") {',
            '    var __sol = new Solution();',
            '    var __methods = Object.getOwnPropertyNames(Object.getPrototypeOf(__sol))',
            '        .filter(function(m) { return m !== "constructor" && typeof __sol[m] === "function"; });',
            '    if (__methods.length > 0) return { fn: __sol[__methods[0]].bind(__sol) };',
            '}'
        );
    }

    // Last defined function = most likely the answer
    for (var i = funcNames.length - 1; i >= 0; i--) {
        detectionParts.push(
            'if (typeof ' + funcNames[i] + ' === "function") return { fn: ' + funcNames[i] + ' };'
        );
    }

    detectionParts.push('return { fn: null };');

    var fullScript = code + '\n' + detectionParts.join('\n');

    // Execute once
    var result;
    try {
        result = new Function(fullScript)();
    } catch (err) {
        throw new Error('Compilation Error: ' + (err.message || String(err)));
    }

    return result && result.fn ? result.fn : null;
}

// ─── Main Message Handler ────────────────────────────────────────────────────

self.onmessage = function (e) {
    var code = e.data.code;
    var testCases = e.data.testCases || [];
    var cap = setupConsoleCapture();

    try {
        var hasFuncDefinition = extractFunctionNames(code).length > 0 || hasSolutionClass(code);

        // PROBLEM MODE: test cases exist AND code appears to define a function/class
        if (testCases.length > 0 && hasFuncDefinition) {
            // Execute code ONCE — also detects the function
            var userFn = executeCodeOnce(code, cap);

            if (userFn !== null && typeof userFn === 'function') {
                // Run each test case against the detected function
                var results = [];
                for (var i = 0; i < testCases.length; i++) {
                    var tc = testCases[i];
                    var start = performance.now();
                    var args = [];
                    try { args = parseInput(tc.input); }
                    catch (pErr) {
                        results.push({ passed: false, input: tc.input, expectedOutput: tc.output, actualOutput: 'Parse Error: ' + pErr.message, executionTime: 0 });
                        continue;
                    }
                    try {
                        var actual = userFn.apply(null, args);
                        var elapsed = performance.now() - start;
                        var actualStr = stringify(actual);
                        var expectedStr = (tc.output || '').trim();
                        results.push({ passed: normalizeAndCompare(actualStr, expectedStr), input: tc.input, expectedOutput: expectedStr, actualOutput: actualStr, executionTime: elapsed });
                    } catch (rErr) {
                        results.push({ passed: false, input: tc.input, expectedOutput: tc.output, actualOutput: 'Runtime Error: ' + rErr.message, executionTime: performance.now() - start });
                    }
                }
                var logs = cap.getLogs();
                cap.restore();
                self.postMessage({ type: 'success', results: results, logs: logs });
                return;
            }
            // Function not found despite having a definition — fall through to free-form
        }

        // FREE-FORM MODE: run code as-is exactly once
        try {
            new Function(code)();
        } catch (err) {
            throw new Error(err.message || String(err));
        }
        var logs = cap.getLogs();
        cap.restore();
        var output = logs.trim() || '(no output — try adding a console.log() statement)';
        self.postMessage({
            type: 'success',
            results: [{ passed: true, input: '(free-form)', expectedOutput: '', actualOutput: output, executionTime: 0 }],
            logs: logs,
            freeForm: true
        });

    } catch (err) {
        cap.restore();
        self.postMessage({ type: 'error', error: err.message || String(err), logs: cap.getLogs() });
    }
};
