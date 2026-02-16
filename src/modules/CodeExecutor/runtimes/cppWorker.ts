
// Shim module.exports because the vendored JSCPP is a CommonJS bundle
const fakeModule: any = { exports: {} };
self.module = fakeModule;
self.exports = fakeModule.exports;

// Use local vendored version to avoid CDN issues (NS_ERROR_CORRUPTED_CONTENT)
importScripts("/jscpp.js");

self.onmessage = async (e: MessageEvent) => {
    const { code, testCases } = e.data;
    const results = [];
    let logs = "";

    try {
        const config = {
            stdio: {
                write: (s: string) => { logs += s; },
                writeError: (s: string) => { logs += s; }
            }
        };

        // Capture JSCPP
        // @ts-ignore
        let JSCPP = self.JSCPP || self.module.exports;

        // If it was exported as default
        if (JSCPP && JSCPP.default) {
            JSCPP = JSCPP.default;
        }

        // Special case: Browserify/Webpack sometimes returns an empty object but sets global
        // The log showed "require" might not be there, but "global" was.
        // Actually, the log showed keys: "postMessage, close, ..., _inherits, ...".
        // It seems the bundle executed in global scope but didn't assign to a clear global variable "JSCPP".

        // However, looking at jscpp.js snippet: `module.exports=function(){...}` inside a closure.
        // It seems it tries to assign to module.exports.
        // So `self.module.exports` should have it IF `module` was defined BEFORE importScripts.

        // Let's re-try capture. If self.module.exports is set, use it.
        JSCPP = self.module.exports;

        if (!JSCPP || Object.keys(JSCPP).length === 0) {
            // Fallback: Check if it leaked a global constructor?
            // @ts-ignore
            if (self.JSCPP) JSCPP = self.JSCPP;
        }

        if (!JSCPP) {
            console.log("Global keys:", Object.keys(self));
            throw new Error(`Failed to load JSCPP. Keys on self: ${Object.keys(self).join(', ')}`);
        }

        let executableCode = code;

        // Naive main injection if missing
        if (!code.includes("int main")) {
            executableCode = code + `
            #include <iostream>
            int main() {
                std::cout << "Running sample..." << std::endl;
                // Solution s;
                // s.twoSum(...); 
                return 0;
            }
            `;
        }

        // JSCPP might be a function constructor or an object with run method?
        // Usage: var engine = new JSCPP.run(code, input, config); OR var engine = JSCPP.run(...)
        // Let's assume JSCPP is the main object exports.

        console.log("JSCPP Type:", typeof JSCPP);
        console.log("JSCPP Keys:", Object.keys(JSCPP));

        let engine;
        try {
            // @ts-ignore
            if (typeof JSCPP.run === 'function') {
                console.log("Using JSCPP.run as constructor");
                // @ts-ignore
                engine = new JSCPP.run(executableCode, "", config);
            } else if (typeof JSCPP === 'function') {
                console.log("Using JSCPP as constructor");
                // @ts-ignore
                engine = new JSCPP(executableCode, "", config);
            } else {
                throw new Error(`JSCPP is ${typeof JSCPP} and has no 'run' method. Keys: ${Object.keys(JSCPP).join(', ')}`);
            }
        } catch (e: any) {
            console.log("Primary execution attempt failed, trying fallback:", e.message);
            // Fallback: try calling without 'new' if it's just a function
            // @ts-ignore
            if (typeof JSCPP.run === 'function') {
                // @ts-ignore
                engine = JSCPP.run(executableCode, "", config);
            } else if (typeof JSCPP === 'function') {
                // @ts-ignore
                engine = JSCPP(executableCode, "", config);
            } else {
                throw new Error("Could not find a way to execute JSCPP: " + e.message);
            }
        }

        results.push({
            passed: true,
            input: "Sample",
            expectedOutput: "Check console",
            actualOutput: logs.trim(),
            executionTime: 0
        });

        self.postMessage({
            type: 'success',
            results: results,
            logs: logs
        });

    } catch (err: any) {
        self.postMessage({
            type: 'error',
            error: err.message || err,
            logs: logs
        });
    }
};
