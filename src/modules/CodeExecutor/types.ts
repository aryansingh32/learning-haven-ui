
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface TestCase {
    input: string;
    output: string;
    isHidden?: boolean;
}

export interface QuestionData {
    id: string;
    title: string;
    description: string; // Markdown
    difficulty: Difficulty;
    examples: Array<{
        input: string;
        output: string;
        explanation?: string;
    }>;
    constraints: string[];
    starterCode: {
        javascript: string;
        python: string;
        cpp: string;
        c: string;
        java: string;
    };
}

export type SupportedLanguage = 'javascript' | 'python' | 'cpp' | 'c' | 'java';

export interface ExecutionResult {
    status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compilation Error';
    output: string;
    expectedOutput?: string;
    error?: string;
    executionTime?: number; // ms
    memoryUsage?: number; // bytes
    testCaseResults?: {
        passed: boolean;
        input: string;
        actualOutput: string;
        expectedOutput: string;
    }[];
}
