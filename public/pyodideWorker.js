/**
 * Python runtime via Pyodide from CDN (classic worker, no bundling).
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
    var testCases = e.data.testCases;
    var logs = [];

    try {
        var py = await initPyodideWorker();
        py.setStdout({ batched: function (msg) { logs.push(msg); } });
        py.setStderr({ batched: function (msg) { logs.push(msg); } });
        py.globals.set("__test_cases_json", JSON.stringify(testCases));

        var driverCode = [
            "import json",
            "import re",
            "",
            "def run_tests():",
            "    test_cases = json.loads(__test_cases_json)",
            "    results = []",
            "    if 'Solution' not in globals():",
            "        return {'error': \"Class 'Solution' not found\"}",
            "    sol = Solution()",
            "    method_name = 'twoSum'",
            "    if not hasattr(sol, method_name):",
            "        methods = [m for m in dir(sol) if not m.startswith('_')]",
            "        if methods:",
            "            method_name = methods[0]",
            "        else:",
            "            return {'error': 'No method found in Solution class'}",
            "    func = getattr(sol, method_name)",
            "    for case in test_cases:",
            "        inp = case.get('input', '')",
            "        out = case.get('output', '')",
            "        try:",
            "            cleaned = re.sub(r'[a-zA-Z_][a-zA-Z0-9_]*\\\\s*=\\\\s*', '', inp)",
            "            input_args = json.loads('[' + cleaned + ']')",
            "        except Exception as parse_err:",
            "            results.append({'passed': False, 'input': inp, 'expectedOutput': out, 'actualOutput': 'Parse error: ' + str(parse_err), 'executionTime': 0})",
            "            continue",
            "        try:",
            "            import time",
            "            start = time.time() * 1000",
            "            result = func(*input_args)",
            "            end = time.time() * 1000",
            "            exec_time = end - start",
            "            actual_output = json.dumps(result) if result is not None else 'null'",
            "            try:",
            "                expected_obj = json.loads(out)",
            "                passed = (result == expected_obj) or (json.dumps(result) == out)",
            "            except Exception:",
            "                passed = (str(result) == out) or (actual_output == out)",
            "            results.append({'passed': passed, 'input': inp, 'expectedOutput': out, 'actualOutput': actual_output, 'executionTime': exec_time})",
            "        except Exception as ex:",
            "            results.append({'passed': False, 'input': inp, 'expectedOutput': out, 'actualOutput': str(ex), 'executionTime': 0})",
            "    return {'results': results}",
            "",
            "run_tests()"
        ].join("\n");

        await py.runPythonAsync(code);
        var outputProxy = await py.runPythonAsync(driverCode);
        var output = outputProxy && outputProxy.toJs ? outputProxy.toJs() : undefined;
        if (outputProxy && outputProxy.destroy) outputProxy.destroy();

        if (output && output.error) {
            throw new Error(output.error);
        }
        self.postMessage({ type: "success", results: (output && output.results) || [], logs: logs.join("\n") });
    } catch (err) {
        self.postMessage({ type: "error", error: err && err.message ? err.message : String(err), logs: logs.join("\n") });
    }
};
