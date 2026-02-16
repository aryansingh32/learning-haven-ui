
// Import Pyodide types if available, otherwise just use any
// In a real project we would install types, but here we assume global load
import { loadPyodide } from "pyodide"; // This won't work without npm install, but we use CDN usually
// Actually, standard way with Vite is to use the CDN in the worker or install it.
// Let's assume we use CDN importScripts in the worker for simplicity and zero-config.

// Web Worker context
const ctx: Worker = self as any;

let pyodide: any = null;

const initPyodide = async () => {
    if (pyodide) return;
    // Load Pyodide script
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

    // @ts-ignore
    pyodide = await loadPyodide();
};

ctx.onmessage = async (e: MessageEvent) => {
    const { code, testCases } = e.data;
    const logs: string[] = [];
    const results = [];

    try {
        if (!pyodide) await initPyodide();

        // Redirect stdout
        pyodide.setStdout({ batched: (msg: string) => logs.push(msg) });
        pyodide.setStderr({ batched: (msg: string) => logs.push(msg) });

        // Run user code
        // We expect a class Solution with a method.
        // We need to instantiate it and call it.

        // This python code wrapper will:
        // 1. Run user code (defines class Solution)
        // 2. Loop through test cases
        // 3. Instantiate Solution
        // 4. Run method
        // 5. Return results

        // We pass test_cases as a python object
        const testCasesPy = JSON.stringify(testCases);

        const driverCode = `
import json
import sys

# User code is already executed in global scope
# We assume 'Solution' class exists

def run_tests(test_cases_json):
    test_cases = json.loads(test_cases_json)
    results = []
    
    if 'Solution' not in globals():
        return {"error": "Class 'Solution' not found"}
        
    sol = Solution()
    
    # We need to find the method name. 
    # Convention: assume 1 public method or 'twoSum'
    # For now, let's hardcode 'twoSum' or inspect
    method_name = 'twoSum'
    if not hasattr(sol, method_name):
        # dynamic search
        methods = [m for m in dir(sol) if not m.startswith('__')]
        if methods:
            method_name = methods[0]
        else:
             return {"error": "No method found in Solution class"}

    func = getattr(sol, method_name)
    
    for case in test_cases:
        input_args = json.loads(f"[{case['input']}]") # Parse "2, 7" -> [2, 7]
        
        # Capture stdout if needed per test case, but we redirect globally
        
        try:
            import time
            start = time.time() * 1000
            
            # Call the function
            result = func(*input_args)
            
            end = time.time() * 1000
            exec_time = end - start
            
            # JSON serialize result
            actual_output = json.dumps(result)
            
            # Compare assuming string match of JSON representations
            # Note: exact match required. [0,1] vs [0, 1] might differ in spaces.
            # Ideally we parse actual output and compare objects.
            expected = case['output']
            
            # Normalize expected if it is json
            try:
                expected_obj = json.loads(expected)
                passed = (result == expected_obj)
            except:
                passed = (str(result) == expected)
            
            results.append({
                "passed": passed,
                "input": case['input'], // Keep original string
                "expectedOutput": case['output'],
                "actualOutput": actual_output,
                "executionTime": exec_time
            })
            
        except Exception as e:
            results.append({
                "passed": False,
                "input": case['input'],
                "expectedOutput": case['output'],
                "actualOutput": str(e),
                "executionTime": 0
            })
            
    return {"results": results}

run_tests('${testCasesPy}')
`;

        await pyodide.runPythonAsync(code); // Load user class
        const outputProxy = await pyodide.runPythonAsync(driverCode);
        const output = outputProxy.toJs();
        outputProxy.destroy();

        if (output.error) {
            throw new Error(output.error);
        }

        ctx.postMessage({
            type: 'success',
            results: output.results,
            logs: logs.join('\n')
        });

    } catch (err: any) {
        ctx.postMessage({
            type: 'error',
            error: err.message,
            logs: logs.join('\n')
        });
    }
};
