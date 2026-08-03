import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CODE_TEMPLATES } from '../constants';
import { executeCode } from '../runtimes';
import { ExecutionResult, QuestionData, SupportedLanguage } from '../types';
import { logger } from '../logger';

interface UseCodeExecutionOptions {
    question: QuestionData;
    initialLanguage?: SupportedLanguage;
    initialCode?: string;
    initialCodeByLanguage?: Partial<Record<SupportedLanguage, string>>;
    initialTheme?: 'light' | 'dark';
    resetCodeOnLanguageChange?: boolean;
    resetOnQuestionChange?: boolean;
    onSolved?: (result: ExecutionResult) => void;
    onRunComplete?: (result: ExecutionResult) => void;
}

export const useCodeExecution = ({
    question,
    initialLanguage = 'javascript',
    initialCode,
    initialCodeByLanguage,
    initialTheme = 'dark',
    resetCodeOnLanguageChange = true,
    resetOnQuestionChange = true,
    onSolved,
    onRunComplete,
}: UseCodeExecutionOptions) => {
    const mergedStarters = useMemo(() => {
        return {
            ...DEFAULT_CODE_TEMPLATES,
            ...question.starterCode,
            ...(initialCodeByLanguage || {}),
        };
    }, [question.starterCode, initialCodeByLanguage]);

    const resolveStarterCode = useCallback((lang: SupportedLanguage) => {
        if (initialCode && lang === initialLanguage) return initialCode;
        return mergedStarters[lang];
    }, [initialCode, initialLanguage, mergedStarters]);

    const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
    const [code, setCode] = useState<string>(() => resolveStarterCode(initialLanguage));
    const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState('testcases');

    useEffect(() => {
        if (!resetCodeOnLanguageChange) return;
        setCode(resolveStarterCode(language));
    }, [language, resetCodeOnLanguageChange, resolveStarterCode]);

    useEffect(() => {
        if (!resetOnQuestionChange) return;
        setExecutionResult(null);
        setActiveTab('testcases');
        setCode(resolveStarterCode(language));
    }, [question.id, resetOnQuestionChange, resolveStarterCode, language]);

    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

    const resetCode = () => setCode(resolveStarterCode(language));

    const handleRun = async (): Promise<ExecutionResult | null> => {
        if (isExecuting) {
            logger.warn('Execution blocked: Already executing');
            return null;
        }

        logger.info('Starting Code Execution (Unified Architecture)', { language, questionId: question.id });
        setIsExecuting(true);
        setActiveTab('result');
        setExecutionResult(null);

        try {
            const result = await executeCode(language, code, question);
            logger.info('Execution Completed', { status: result.status });
            setExecutionResult(result);
            onRunComplete?.(result);
            return result;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            logger.error('Execution Failed', error);
            const errResult: ExecutionResult = {
                status: 'Runtime Error',
                output: message,
                executionTime: 0,
            };
            setExecutionResult(errResult);
            onRunComplete?.(errResult);
            return errResult;
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSubmit = async () => {
        logger.info('Submitting Solution', { language, questionId: question.id });
        setActiveTab('result');
        const result = await handleRun();
        if (onSolved && result?.status === 'Accepted') {
            onSolved(result);
        }
        return result;
    };

    return {
        language,
        setLanguage,
        code,
        setCode,
        theme,
        toggleTheme,
        isExecuting,
        executionResult,
        activeTab,
        setActiveTab,
        handleRun,
        handleSubmit,
        resetCode,
    };
};
