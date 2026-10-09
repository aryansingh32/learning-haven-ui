import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    /** Submit to a server judge instead of re-running in the browser. */
    onSubmit?: (code: string, language: SupportedLanguage) => Promise<ExecutionResult>;
    /** Autosave code per language under this key (e.g. the problem slug). */
    storageKey?: string;
}

const savedCode = (key: string | undefined, lang: SupportedLanguage): string | null => {
    if (!key) return null;
    try { return localStorage.getItem(`forge-code:${key}:${lang}`); } catch { return null; }
};

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
    onSubmit,
    storageKey,
}: UseCodeExecutionOptions) => {
    // Keyed on content, not object identity: a refetched question must not reset the editor.
    const startersKey = JSON.stringify([question.starterCode, initialCodeByLanguage ?? null]);
    const mergedStarters = useMemo(() => {
        return {
            ...DEFAULT_CODE_TEMPLATES,
            ...question.starterCode,
            ...(initialCodeByLanguage || {}),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startersKey]);

    const resolveStarterCode = useCallback((lang: SupportedLanguage) => {
        if (initialCode && lang === initialLanguage) return initialCode;
        return mergedStarters[lang];
    }, [initialCode, initialLanguage, mergedStarters]);

    // Saved work wins over the starter code; Reset goes back to the starter.
    const resolveCode = useCallback((lang: SupportedLanguage) => savedCode(storageKey, lang) ?? resolveStarterCode(lang), [storageKey, resolveStarterCode]);

    const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
    const [code, setCode] = useState<string>(() => resolveCode(initialLanguage));
    const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState('testcases');

    // Load the code for a language only when the learner actually switches language.
    const lastLanguage = useRef(language);
    useEffect(() => {
        if (lastLanguage.current === language) return;
        lastLanguage.current = language;
        if (!resetCodeOnLanguageChange) return;
        setCode(resolveCode(language));
    }, [language, resetCodeOnLanguageChange, resolveCode]);

    useEffect(() => {
        if (!storageKey) return;
        const id = setTimeout(() => {
            try {
                const key = `forge-code:${storageKey}:${language}`;
                if (code === resolveStarterCode(language)) localStorage.removeItem(key);
                else localStorage.setItem(key, code);
            } catch { /* storage unavailable */ }
        }, 500);
        return () => clearTimeout(id);
    }, [code, language, storageKey, resolveStarterCode]);

    // Reset only when a different question is opened (not on a refetch of the same one).
    const lastQuestionId = useRef(question.id);
    useEffect(() => {
        if (lastQuestionId.current === question.id) return;
        lastQuestionId.current = question.id;
        if (!resetOnQuestionChange) return;
        setExecutionResult(null);
        setActiveTab('testcases');
        setCode(resolveCode(language));
    }, [question.id, resetOnQuestionChange, resolveCode, language]);

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
        if (onSubmit) {
            if (isExecuting) return null;
            setIsExecuting(true);
            setExecutionResult(null);
            try {
                const judged = await onSubmit(code, language);
                setExecutionResult(judged);
                if (onSolved && judged.status === 'Accepted') onSolved(judged);
                return judged;
            } catch (error: unknown) {
                const failed: ExecutionResult = { status: 'Runtime Error', output: error instanceof Error ? error.message : 'Submission failed.', executionTime: 0 };
                setExecutionResult(failed);
                return failed;
            } finally {
                setIsExecuting(false);
            }
        }
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
