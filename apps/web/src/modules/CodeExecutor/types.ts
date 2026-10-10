
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface TestCase {
    input: string;
    output: string;
    isHidden?: boolean;
}

export type CompareMode = 'exact' | 'unordered' | 'unordered_deep';

export interface QuestionData {
    id: string;
    /** How outputs are compared (same rule the server judge uses). Defaults to exact. */
    compareMode?: CompareMode;
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
    /** 'Ran' = a custom-input run with no expected output (nothing to compare). */
    status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compilation Error' | 'Ran';
    output: string;
    expectedOutput?: string;
    error?: string;
    executionTime?: number; // ms
    memoryUsage?: number; // bytes (peak for the whole run; only the server judge measures it)
    /** Where the code ran. Browser runs can't measure memory. */
    ranIn?: 'browser' | 'server';
    /** Set for a run on an input the learner typed. */
    custom?: { input: string; expected: string | null; output: string | null; error: string | null; matched?: boolean };
    freeForm?: boolean; // true when running arbitrary code (not LeetCode problem mode)
    testCaseResults?: {
        passed: boolean;
        input: string;
        actualOutput: string;
        expectedOutput: string;
        /** Hidden server tests: shown as pass/fail only. */
        hidden?: boolean;
        label?: string;
        error?: string;
    }[];
    /** Set when the result came from the server judge (Submit). */
    judged?: { passed: number; total: number };
}
