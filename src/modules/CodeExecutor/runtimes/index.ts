
import { runJavascript } from "./javascript";
import { runPython } from "./python";
import { runCpp } from "./cpp";
import { runJava } from "./java";
import { ExecutionResult, SupportedLanguage, QuestionData } from "../types";
import { logger } from "../logger";

export const executeCode = async (
    language: SupportedLanguage,
    code: string,
    question: QuestionData
): Promise<ExecutionResult> => {

    logger.debug(`Dispatching execution for ${language}`, { codeSnippet: code.substring(0, 50) + "..." });

    // Convert question examples to TestCases
    const testCases = question.examples.map(ex => ({
        input: ex.input,
        output: ex.output,
        isHidden: false
    }));

    switch (language) {
        case 'javascript':
            return runJavascript(code, testCases);
        case 'python':
            return runPython(code, testCases);
        case 'cpp':
        case 'c':
            return runCpp(code, testCases);
        case 'java':
            return runJava(code, testCases);
        default:
            return {
                status: 'Runtime Error',
                output: 'Language not supported',
                executionTime: 0
            };
    }
};
