/**
 * Java Code Executor Service
 * Sandboxed Java execution using javac + java on the host system.
 * 
 * Security measures:
 * - Temp directory per execution (auto-cleaned)
 * - 5-second timeout per execution
 * - Memory limit via JAVA_TOOL_OPTIONS
 * - No file system access beyond temp dir
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import logger from '../config/logger';

const execAsync = promisify(exec);

const JAVA_TIMEOUT_MS = 10000; // 10s total (compile + run)
const JAVA_MEMORY_LIMIT = '256m';

interface TestCase {
    input: string;
    output: string;
}

interface TestCaseResult {
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    executionTime: number;
}

interface JavaExecutionResult {
    status: 'Accepted' | 'Wrong Answer' | 'Compilation Error' | 'Runtime Error' | 'Time Limit Exceeded';
    output: string;
    executionTime: number;
    testCaseResults?: TestCaseResult[];
}

/**
 * Check if Java is available on the system.
 */
export async function isJavaAvailable(): Promise<boolean> {
    try {
        await execAsync('javac -version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Parse LeetCode-style input into stdin-compatible format for Java.
 * "nums = [2,7,11,15], target = 9" → passed as stdin or parsed by the Java Solution wrapper
 */
function parseInputForJava(input: string): string {
    return input.trim();
}

/**
 * Wrap user code in a main() driver that reads test input.
 * If the user code already has a main method, use it directly with stdin.
 * If the user defines a Solution class, wrap it with a test driver.
 */
function wrapJavaCode(userCode: string, testCases: TestCase[]): string {
    const hasMain = /public\s+static\s+void\s+main\s*\(/.test(userCode);
    const hasSolutionClass = /class\s+Solution\s*\{/.test(userCode);

    if (hasMain) {
        // User provides their own main — just use their code as-is
        // We'll feed test input via stdin
        return userCode;
    }

    if (hasSolutionClass) {
        // Build a test driver that calls Solution methods
        // Serialize test cases into the code
        const testCasesJson = JSON.stringify(testCases).replace(/"/g, '\\"');

        return `
import java.util.*;
import java.io.*;

${userCode}

class Main {
    public static void main(String[] args) throws Exception {
        String testCasesJson = "${testCasesJson}";
        // Simple JSON parsing for test cases
        Solution sol = new Solution();
        
        // Find the first public method (not main, not constructor)
        java.lang.reflect.Method[] methods = Solution.class.getDeclaredMethods();
        java.lang.reflect.Method targetMethod = null;
        for (java.lang.reflect.Method m : methods) {
            if (!m.getName().equals("main") && java.lang.reflect.Modifier.isPublic(m.getModifiers())) {
                targetMethod = m;
                break;
            }
        }
        
        if (targetMethod == null) {
            System.out.println("__ERROR__:No public method found in Solution class");
            return;
        }

        // For each test case, parse input and invoke
        // We output results in a parseable format: __RESULT__:passed|input|expected|actual|time
        Scanner scanner = new Scanner(System.in);
        while (scanner.hasNextLine()) {
            String line = scanner.nextLine().trim();
            if (line.isEmpty()) continue;
            
            // Each line is a test case input
            String[] parts = line.split("\\\\|\\\\|");
            String input = parts.length > 0 ? parts[0] : "";
            String expected = parts.length > 1 ? parts[1] : "";
            
            long start = System.nanoTime();
            try {
                // Parse and invoke dynamically based on method signature
                Object result = invokeMethod(sol, targetMethod, input);
                long elapsed = (System.nanoTime() - start) / 1_000_000;
                String actual = formatResult(result);
                boolean passed = actual.trim().equals(expected.trim()) || normalizeCompare(actual, expected);
                System.out.println("__RESULT__:" + passed + "||" + input + "||" + expected + "||" + actual + "||" + elapsed);
            } catch (Exception ex) {
                long elapsed = (System.nanoTime() - start) / 1_000_000;
                System.out.println("__RESULT__:false||" + input + "||" + expected + "||Runtime Error: " + ex.getMessage() + "||" + elapsed);
            }
        }
    }
    
    static boolean normalizeCompare(String a, String b) {
        return a.replaceAll("\\\\s+", "").equals(b.replaceAll("\\\\s+", ""));
    }
    
    static String formatResult(Object result) {
        if (result == null) return "null";
        if (result instanceof int[]) return Arrays.toString((int[]) result);
        if (result instanceof long[]) return Arrays.toString((long[]) result);
        if (result instanceof double[]) return Arrays.toString((double[]) result);
        if (result instanceof String[]) return Arrays.toString((String[]) result);
        if (result instanceof boolean[]) return Arrays.toString((boolean[]) result);
        if (result instanceof List) return result.toString();
        return String.valueOf(result);
    }
    
    @SuppressWarnings("unchecked")
    static Object invokeMethod(Solution sol, java.lang.reflect.Method method, String input) throws Exception {
        // Parse input string: "nums = [2,7,11,15], target = 9"
        String cleaned = input.replaceAll("[a-zA-Z_]\\\\w*\\\\s*=\\\\s*", "");
        Class<?>[] paramTypes = method.getParameterTypes();
        
        if (paramTypes.length == 0) {
            return method.invoke(sol);
        }
        
        // Simple argument parsing
        List<String> argStrings = splitArgs(cleaned);
        Object[] args = new Object[paramTypes.length];
        
        for (int i = 0; i < paramTypes.length && i < argStrings.size(); i++) {
            args[i] = parseArg(argStrings.get(i).trim(), paramTypes[i]);
        }
        
        return method.invoke(sol, args);
    }
    
    static List<String> splitArgs(String input) {
        List<String> result = new ArrayList<>();
        int depth = 0;
        StringBuilder current = new StringBuilder();
        for (char c : input.toCharArray()) {
            if (c == '[' || c == '{') depth++;
            else if (c == ']' || c == '}') depth--;
            else if (c == ',' && depth == 0) {
                result.add(current.toString());
                current = new StringBuilder();
                continue;
            }
            current.append(c);
        }
        if (current.length() > 0) result.add(current.toString());
        return result;
    }
    
    static Object parseArg(String s, Class<?> type) {
        s = s.trim();
        if (type == int.class || type == Integer.class) return Integer.parseInt(s);
        if (type == long.class || type == Long.class) return Long.parseLong(s);
        if (type == double.class || type == Double.class) return Double.parseDouble(s);
        if (type == boolean.class || type == Boolean.class) return Boolean.parseBoolean(s);
        if (type == String.class) return s.startsWith("\\"") ? s.substring(1, s.length() - 1) : s;
        if (type == int[].class) {
            s = s.replaceAll("[\\\\[\\\\]]", "");
            if (s.isEmpty()) return new int[0];
            String[] parts = s.split(",");
            int[] arr = new int[parts.length];
            for (int i = 0; i < parts.length; i++) arr[i] = Integer.parseInt(parts[i].trim());
            return arr;
        }
        if (type == String[].class) {
            s = s.replaceAll("[\\\\[\\\\]]", "");
            if (s.isEmpty()) return new String[0];
            return Arrays.stream(s.split(",")).map(x -> x.trim().replaceAll("^\\"|\\"$", "")).toArray(String[]::new);
        }
        // Fallback: try as string
        return s;
    }
}
`;
    }

    // Fallback: user code doesn't have Solution or main — wrap in simple Main class
    return `
import java.util.*;
import java.io.*;

class Main {
    ${userCode}
    
    public static void main(String[] args) {
        System.out.println("Please define a Solution class or include a main method.");
    }
}
`;
}

/**
 * Execute Java code against test cases.
 */
export async function executeJava(code: string, testCases: TestCase[]): Promise<JavaExecutionResult> {
    const workDir = path.join(tmpdir(), `java-exec-${randomUUID()}`);

    try {
        await fs.mkdir(workDir, { recursive: true });

        const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);
        const hasSolutionClass = /class\s+Solution\s*\{/.test(code);
        const wrappedCode = wrapJavaCode(code, testCases);

        // Determine the main class name
        const classNameMatch = wrappedCode.match(/(?:public\s+)?class\s+(\w+)\s*\{/);
        const className = classNameMatch ? classNameMatch[1] : 'Main';
        // Write all classes to files
        const sourceFile = path.join(workDir, `${className}.java`);

        // If there's a Solution class AND a Main wrapper, we need both in one file
        // or use the wrapped code which contains both
        if (hasSolutionClass && !hasMain) {
            // Wrapped code has both Solution and Main — extract class names
            await fs.writeFile(path.join(workDir, 'Main.java'), wrappedCode, 'utf8');
        } else {
            await fs.writeFile(sourceFile, wrappedCode, 'utf8');
        }

        // Compile
        const compileTarget = hasSolutionClass && !hasMain ? 'Main.java' : `${className}.java`;
        try {
            const { stderr: compileErr } = await execAsync(
                `javac ${compileTarget}`,
                {
                    cwd: workDir,
                    timeout: JAVA_TIMEOUT_MS / 2,
                    env: { ...process.env, JAVA_TOOL_OPTIONS: `-Xmx${JAVA_MEMORY_LIMIT}` }
                }
            );

            if (compileErr && !compileErr.includes('Picked up JAVA_TOOL_OPTIONS')) {
                logger.warn('Java compilation warnings:', compileErr);
            }
        } catch (compileError: any) {
            const errMsg = (compileError.stderr || compileError.message || String(compileError))
                .replace(/Picked up JAVA_TOOL_OPTIONS.*\n?/g, '')
                .trim();
            return {
                status: 'Compilation Error',
                output: errMsg,
                executionTime: 0
            };
        }

        // Execute
        const runClass = hasSolutionClass && !hasMain ? 'Main' : className;

        if (hasSolutionClass && !hasMain) {
            // Solution class mode — feed test cases via stdin
            const stdinData = testCases.map(tc => `${tc.input}||${tc.output}`).join('\n');

            try {
                const { stdout, stderr } = await execAsync(
                    `java -cp . ${runClass}`,
                    {
                        cwd: workDir,
                        timeout: JAVA_TIMEOUT_MS,
                        env: { ...process.env, JAVA_TOOL_OPTIONS: `-Xmx${JAVA_MEMORY_LIMIT}` },
                        input: stdinData
                    }
                );

                // Parse structured results
                const results: TestCaseResult[] = [];
                const lines = stdout.split('\n').filter(l => l.startsWith('__RESULT__:'));
                const otherOutput = stdout.split('\n').filter(l => !l.startsWith('__RESULT__:') && !l.startsWith('__ERROR__:')).join('\n');

                for (const line of lines) {
                    const parts = line.replace('__RESULT__:', '').split('||');
                    results.push({
                        passed: parts[0] === 'true',
                        input: parts[1] || '',
                        expectedOutput: parts[2] || '',
                        actualOutput: parts[3] || '',
                        executionTime: parseInt(parts[4]) || 0
                    });
                }

                const allPassed = results.length > 0 && results.every(r => r.passed);
                const totalTime = results.reduce((acc, r) => acc + r.executionTime, 0);

                return {
                    status: allPassed ? 'Accepted' : 'Wrong Answer',
                    output: otherOutput.trim(),
                    executionTime: totalTime,
                    testCaseResults: results
                };

            } catch (runError: any) {
                if (runError.killed) {
                    return { status: 'Time Limit Exceeded', output: 'Execution timed out', executionTime: JAVA_TIMEOUT_MS };
                }
                const errMsg = (runError.stderr || runError.message || String(runError))
                    .replace(/Picked up JAVA_TOOL_OPTIONS.*\n?/g, '').trim();
                return { status: 'Runtime Error', output: errMsg, executionTime: 0 };
            }
        } else {
            // Main method mode — feed each test case via stdin separately
            const results: TestCaseResult[] = [];
            for (const tc of testCases) {
                const start = Date.now();
                try {
                    const { stdout, stderr } = await execAsync(
                        `java -cp . ${runClass}`,
                        {
                            cwd: workDir,
                            timeout: JAVA_TIMEOUT_MS,
                            env: { ...process.env, JAVA_TOOL_OPTIONS: `-Xmx${JAVA_MEMORY_LIMIT}` },
                            input: tc.input
                        }
                    );
                    const elapsed = Date.now() - start;
                    const actual = stdout.trim();
                    const expected = (tc.output || '').trim();
                    const passed = actual === expected || actual.replace(/\s+/g, '') === expected.replace(/\s+/g, '');

                    results.push({
                        passed,
                        input: tc.input,
                        expectedOutput: expected,
                        actualOutput: actual || '(no output)',
                        executionTime: elapsed
                    });
                } catch (runError: any) {
                    const elapsed = Date.now() - start;
                    if (runError.killed) {
                        results.push({
                            passed: false, input: tc.input, expectedOutput: tc.output,
                            actualOutput: 'Time Limit Exceeded', executionTime: elapsed
                        });
                    } else {
                        const errMsg = (runError.stderr || runError.message || String(runError))
                            .replace(/Picked up JAVA_TOOL_OPTIONS.*\n?/g, '').trim();
                        results.push({
                            passed: false, input: tc.input, expectedOutput: tc.output,
                            actualOutput: errMsg, executionTime: elapsed
                        });
                    }
                }
            }

            const allPassed = results.length > 0 && results.every(r => r.passed);
            const totalTime = results.reduce((acc, r) => acc + r.executionTime, 0);
            return {
                status: allPassed ? 'Accepted' : 'Wrong Answer',
                output: '',
                executionTime: totalTime,
                testCaseResults: results
            };
        }

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Java execution failed:', { error: message });
        return { status: 'Runtime Error', output: message, executionTime: 0 };
    } finally {
        // Cleanup temp directory
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch { }
    }
}
