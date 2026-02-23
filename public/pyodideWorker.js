/**
 * Python Runtime Worker via Pyodide (Classic Worker)
 * SaaS-grade: Supports ANY problem, not just Two Sum.
 *
 * Function detection priority:
 *   1. Explicit `functionName` from message payload
 *   2. Solution class — auto-detects the first non-dunder method
 *   3. Last standalone function defined in code
 */

var pyodide = null;

function initPyodideWorker() {
    if (pyodide) return Promise.resolve(pyodide);
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");
    return self.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" })
        .then(function (p) { pyodide = p; return p; });
}

self.onmessage = async function (e) {
    var code = e.data.code;
    var testCases = e.data.testCases || [];
    var functionName = e.data.functionName || null;
    var logs = [];

    try {
        var py = await initPyodideWorker();
        py.setStdout({ batched: function (msg) { logs.push(msg); } });
        py.setStderr({ batched: function (msg) { logs.push("[STDERR] " + msg); } });

        // Pass test data into Python globals
        py.globals.set("__test_cases_json", JSON.stringify(testCases));
        py.globals.set("__hint_function_name", functionName || "");

        // Generic driver code that auto-detects the user's function
        var driverCode = [
            "import json, re, time, inspect",
            "",
            "def __run_tests():",
            "    test_cases = json.loads(__test_cases_json)",
            "    hint_name = __hint_function_name",
            "    results = []",
            "",
            "    # --- Function Detection ---",
            "    func = None",
            "    func_name = None",
            "",
            "    # Priority 1: Explicit hint",
            "    if hint_name and hint_name in globals():",
            "        obj = globals()[hint_name]",
            "        if callable(obj):",
            "            func = obj",
            "            func_name = hint_name",
            "",
            "    # Priority 2: Solution class with any method",
            "    if func is None and 'Solution' in globals():",
            "        sol = Solution()",
            "        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]",
            "        if methods:",
            "            if hint_name and hint_name in methods:",
            "                func = getattr(sol, hint_name)",
            "            else:",
            "                func = getattr(sol, methods[0])",
            "            func_name = methods[0] if not hint_name else hint_name",
            "",
            "    # Priority 3: Last user-defined function (not built-in)",
            "    if func is None:",
            "        user_funcs = []",
            "        for name, obj in list(globals().items()):",
            "            if (callable(obj) and not name.startswith('_') ",
            "                and name not in ('__run_tests',) ",
            "                and not inspect.isclass(obj)",
            "                and not inspect.ismodule(obj)",
            "                and not inspect.isbuiltin(obj)):",
            "                try:",
            "                    src = inspect.getsource(obj)",
            "                    user_funcs.append((name, obj))",
            "                except (TypeError, OSError):",
            "                    pass",
            "        if user_funcs:",
            "            func_name, func = user_funcs[-1]",
            "",
            "    if func is None:",
            "        return {'error': 'No executable function found. Define a function or a Solution class.'}",
            "",
            "    # --- Run Test Cases ---",
            "    for case in test_cases:",
            "        inp = case.get('input', '')",
            "        expected = case.get('output', '')",
            "        try:",
            "            cleaned = re.sub(r'[a-zA-Z_][a-zA-Z0-9_]*\\\\s*=\\\\s*', '', inp)",
            "            cleaned = cleaned.strip()",
            "            if cleaned:",
            "                input_args = json.loads('[' + cleaned + ']')",
            "            else:",
            "                input_args = []",
            "        except Exception as parse_err:",
            "            results.append({",
            "                'passed': False,",
            "                'input': inp,",
            "                'expectedOutput': expected,",
            "                'actualOutput': 'Parse error: ' + str(parse_err),",
            "                'executionTime': 0",
            "            })",
            "            continue",
            "        try:",
            "            start = time.time() * 1000",
            "            result = func(*input_args)",
            "            end = time.time() * 1000",
            "            exec_time = end - start",
            "            actual_output = json.dumps(result) if result is not None else 'null'",
            "            try:",
            "                expected_obj = json.loads(expected)",
            "                passed = (result == expected_obj) or (json.dumps(result) == expected)",
            "            except Exception:",
            "                passed = (str(result) == expected) or (actual_output == expected)",
            "            results.append({",
            "                'passed': passed,",
            "                'input': inp,",
            "                'expectedOutput': expected,",
            "                'actualOutput': actual_output,",
            "                'executionTime': exec_time",
            "            })",
            "        except Exception as ex:",
            "            results.append({",
            "                'passed': False,",
            "                'input': inp,",
            "                'expectedOutput': expected,",
            "                'actualOutput': 'Runtime Error: ' + str(ex),",
            "                'executionTime': 0",
            "            })",
            "    return {'results': results}",
            "",
            "__run_tests()"
        ].join("\n");

        // Execute user code first (defines Solution class or functions)
        await py.runPythonAsync(code);

        // Then run test driver
        var outputProxy = await py.runPythonAsync(driverCode);

        // CRITICAL: Convert Python dicts to plain JS objects (not Maps).
        // Without dict_converter, toJs() creates Maps which break property access.
        var rawOutput = outputProxy && outputProxy.toJs
            ? outputProxy.toJs({ dict_converter: Object.fromEntries })
            : undefined;
        if (outputProxy && outputProxy.destroy) outputProxy.destroy();

        // Ensure deep conversion — nested results may still be Maps
        var output = rawOutput;
        if (output && output instanceof Map) {
            output = Object.fromEntries(output);
        }

        if (output && output.error) {
            throw new Error(output.error);
        }

        // Deep convert results array entries
        var results = [];
        var rawResults = (output && output.results) || [];
        for (var i = 0; i < rawResults.length; i++) {
            var r = rawResults[i];
            if (r instanceof Map) r = Object.fromEntries(r);
            results.push({
                passed: !!r.passed,
                input: String(r.input || ''),
                expectedOutput: String(r.expectedOutput || ''),
                actualOutput: String(r.actualOutput || ''),
                executionTime: Number(r.executionTime) || 0
            });
        }

        self.postMessage({
            type: "success",
            results: results,
            logs: logs.join("\n")
        });
    } catch (err) {
        self.postMessage({
            type: "error",
            error: err && err.message ? err.message : String(err),
            logs: logs.join("\n")
        });
    }
};
