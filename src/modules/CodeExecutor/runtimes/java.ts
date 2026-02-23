
import { ExecutionResult, TestCase } from "../types";
import { logger } from "../logger";

/**
 * Run Java code via backend JDK execution.
 * Falls back to a helpful error message if the backend is unavailable.
 */
export const runJava = async (code: string, testCases: TestCase[]): Promise<ExecutionResult> => {
    logger.info("Java execution started (Backend JDK)", {
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    // Try backend execution
    const backendUrls = [
        '/api/execute/java',                    // Same origin (proxied via Vite)
        'http://localhost:3000/api/execute/java', // Direct backend
    ];

    for (const url of backendUrls) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000); // 15s total timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, testCases }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                logger.warn(`Java backend responded with ${response.status}`, errorData);

                if (response.status === 400) {
                    return {
                        status: 'Compilation Error',
                        output: errorData.error || errorData.output || 'Invalid code',
                        executionTime: 0
                    };
                }
                continue; // Try next URL
            }

            const result = await response.json();
            logger.info("Java execution completed via backend", { status: result.status });

            return {
                status: result.status || 'Runtime Error',
                output: result.output || '',
                executionTime: result.executionTime || 0,
                testCaseResults: result.testCaseResults
            };

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                return {
                    status: 'Time Limit Exceeded',
                    output: 'Java execution timed out (15s limit)',
                    executionTime: 15000
                };
            }
            logger.debug(`Java backend not available at ${url}`, err);
            continue; // Try next URL
        }
    }

    // All backends failed — show helpful message
    logger.warn("No Java backend available");
    return {
        status: 'Runtime Error',
        output: [
            '⚠️ Java execution requires the backend server to be running.',
            '',
            'To start the backend:',
            '  cd backend && npm run dev',
            '',
            'The backend uses your system\'s JDK (javac + java) to compile and run Java code.',
            'JDK 11+ is required.',
            '',
            'Alternatively, use JavaScript, Python, or C++ which run entirely in your browser.'
        ].join('\n'),
        executionTime: 0
    };
};
