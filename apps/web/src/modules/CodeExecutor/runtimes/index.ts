import { runJavascript } from "./javascript";
import { runPython } from "./python";
import { runCpp } from "./cpp";
import { runJava } from "./java";
import { ExecutionResult, SupportedLanguage, QuestionData } from "../types";
import { logger } from "../logger";
import { compareOutputs } from "@repo/assessment-core";


export const executeCode = async (
    language: SupportedLanguage,
    code: string,
    question: QuestionData
): Promise<ExecutionResult> => {

    // Input validation
    if (!code || !code.trim()) {
        return {
            status: 'Runtime Error',
            output: 'No code provided. Please write your solution before running.',
            executionTime: 0
        };
    }

    logger.debug(`Dispatching execution for ${language}`, { codeSnippet: code.substring(0, 50) + "..." });

    // Convert question examples to TestCases (empty array = free-form / playground mode)
    const testCases = (question.examples || []).map(ex => ({
        input: ex.input,
        output: ex.output,
        isHidden: false
    }));

    const startTime = performance.now();

    let result: ExecutionResult;

    switch (language) {
        case 'javascript':
            result = await runJavascript(code, testCases);
            break;
        case 'python':
            result = await runPython(code, testCases);
            break;
        case 'cpp':
        case 'c':
            result = await runCpp(code, testCases);
            break;
        case 'java':
            result = await runJava(code, testCases);
            break;
        default:
            result = {
                status: 'Runtime Error',
                output: `Language "${language}" is not supported. Available: JavaScript, Python, C++, C, Java.`,
                executionTime: 0
            };
    }

    // Re-check with the problem's compare rule (e.g. "any order"), the same one the server judge uses.
    if (question.compareMode && question.compareMode !== 'exact' && result.testCaseResults?.length) {
        const rechecked = result.testCaseResults.map((r) => ({
            ...r,
            passed: r.passed || (!/^(Runtime Error|Parse error)/.test(r.actualOutput) && compareOutputs(r.actualOutput, r.expectedOutput, question.compareMode)),
        }));
        const allPassed = rechecked.every((r) => r.passed);
        result = {
            ...result,
            testCaseResults: rechecked,
            status: result.status === 'Wrong Answer' && allPassed ? 'Accepted' : result.status,
        };
    }

    const totalDuration = Math.round(performance.now() - startTime);

    // Track analytics
    logger.trackExecution({
        language,
        duration: totalDuration,
        status: result.status,
        codeLength: code.length,
        testCaseCount: testCases.length,
    });

    return result;
};
