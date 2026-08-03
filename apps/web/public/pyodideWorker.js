/**
 * Python Runtime Worker via Pyodide (Classic Worker)
 * DUAL MODE:
 *   1. FREE-FORM: No test cases, or code has no Solution class/callable → runs code, shows print() output.
 *   2. PROBLEM: Has test cases + Solution class or named function → calls it per test case.
 *
 * Key fix: mode is determined BEFORE running code (via static analysis of the source),
 * then code is only executed once.
 */

var pyodide = null;

function initPyodide() {
    if (pyodide) return Promise.resolve(pyodide);
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");
    return self.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" })
        .then(function (p) { pyodide = p; return p; });
}

// Static check: does the code look like a LeetCode solution?
function looksLikeProblem(code) {
    return /class\s+Solution\s*:/.test(code) || /^def\s+\w+\s*\(/m.test(code);
}

self.onmessage = async function (e) {
    var code = e.data.code;
    var testCases = e.data.testCases || [];
    var fnName = e.data.functionName || null;
    var logs = [];

    try {
        var py = await initPyodide();
        py.setStdout({ batched: function (msg) { logs.push(msg); } });
        py.setStderr({ batched: function (msg) { logs.push('[STDERR] ' + msg); } });

        var isProblemMode = testCases.length > 0 && looksLikeProblem(code);

        // Always run user code first — captures print() output AND defines functions/classes
        await py.runPythonAsync(code);

        if (isProblemMode) {
            // ─── PROBLEM MODE ──────────────────────────────────────────────────────
            py.globals.set('__test_cases_json', JSON.stringify(testCases));
            py.globals.set('__hint_name', fnName || '');

            var driver = [
                "import json, re, time, inspect",
                "",
                "def __run_tests():",
                "    cases = json.loads(__test_cases_json)",
                "    hint  = __hint_name",
                "    results = []",
                "",
                "    # Detect function",
                "    func = None",
                "    if hint and hint in globals() and callable(globals()[hint]):",
                "        func = globals()[hint]",
                "    if func is None and 'Solution' in globals():",
                "        sol = Solution()",
                "        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]",
                "        if methods:",
                "            func = getattr(sol, hint if hint and hint in methods else methods[0])",
                "    if func is None:",
                "        # Last user-defined function",
                "        for name in reversed(list(globals().keys())):",
                "            obj = globals()[name]",
                "            if callable(obj) and not name.startswith('_') and not inspect.isclass(obj) and not inspect.ismodule(obj) and not inspect.isbuiltin(obj):",
                "                try:",
                "                    inspect.getsource(obj)",
                "                    func = obj",
                "                    break",
                "                except (TypeError, OSError):",
                "                    pass",
                "    if func is None:",
                "        return {'error': 'No function or Solution class found in your code.'}",
                "",
                "    for case in cases:",
                "        inp      = case.get('input', '')",
                "        expected = case.get('output', '')",
                "        try:",
                "            cleaned = re.sub(r'[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*', '', inp).strip()",
                "            args    = json.loads('[' + cleaned + ']') if cleaned else []",
                "        except Exception as pe:",
                "            results.append({'passed': False, 'input': inp, 'expectedOutput': expected, 'actualOutput': 'Parse error: ' + str(pe), 'executionTime': 0})",
                "            continue",
                "        try:",
                "            t0     = time.time() * 1000",
                "            result = func(*args)",
                "            t1     = time.time() * 1000",
                "            actual = json.dumps(result) if result is not None else 'null'",
                "            try:",
                "                passed = result == json.loads(expected) or actual == expected",
                "            except Exception:",
                "                passed = str(result) == expected or actual == expected",
                "            results.append({'passed': passed, 'input': inp, 'expectedOutput': expected, 'actualOutput': actual, 'executionTime': t1 - t0})",
                "        except Exception as ex:",
                "            results.append({'passed': False, 'input': inp, 'expectedOutput': expected, 'actualOutput': 'Runtime Error: ' + str(ex), 'executionTime': 0})",
                "    return {'results': results}",
                "",
                "__run_tests()"
            ].join('\n');

            var proxy = await py.runPythonAsync(driver);
            var raw = proxy && proxy.toJs ? proxy.toJs({ dict_converter: Object.fromEntries }) : undefined;
            if (proxy && proxy.destroy) proxy.destroy();

            // Deep-convert any remaining Maps
            if (raw instanceof Map) raw = Object.fromEntries(raw);
            if (raw && raw.error) throw new Error(raw.error);

            var results = [];
            var rawList = (raw && raw.results) || [];
            for (var i = 0; i < rawList.length; i++) {
                var r = rawList[i] instanceof Map ? Object.fromEntries(rawList[i]) : rawList[i];
                results.push({
                    passed: !!r.passed,
                    input: String(r.input || ''),
                    expectedOutput: String(r.expectedOutput || ''),
                    actualOutput: String(r.actualOutput || ''),
                    executionTime: Number(r.executionTime) || 0
                });
            }

            self.postMessage({ type: 'success', results: results, logs: logs.join('\n') });

        } else {
            // ─── FREE-FORM MODE ────────────────────────────────────────────────────
            // Code already ran above, logs[] has all print() output.
            var output = logs.join('\n').trim() || '(no output — try adding a print() statement)';
            self.postMessage({
                type: 'success',
                results: [{ passed: true, input: '(free-form)', expectedOutput: '', actualOutput: output, executionTime: 0 }],
                logs: logs.join('\n'),
                freeForm: true
            });
        }

    } catch (err) {
        self.postMessage({
            type: 'error',
            error: err && err.message ? err.message : String(err),
            logs: logs.join('\n')
        });
    }
};
