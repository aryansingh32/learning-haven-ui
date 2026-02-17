import React, { useState, useEffect } from 'react';
import { ResizeLayout } from './components/ResizeLayout';
import { QuestionPanel } from './components/QuestionPanel';
import { EditorPanel } from './components/EditorPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { QuestionData, SupportedLanguage, ExecutionResult } from './types';
import { DEFAULT_CODE_TEMPLATES } from './constants';
import { executeCode } from './runtimes/index';
import { cn } from '@/lib/utils';

interface CodeExecutionModuleProps {
    question: QuestionData;
    onSolved?: (stats: any) => void;
    initialCode?: string;
    theme?: 'light' | 'dark';
}

import { ChevronLeft, ChevronRight, List, LayoutGrid, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

import { logger } from './logger';

export const CodeExecutionModule: React.FC<CodeExecutionModuleProps> = ({
    question,
    onSolved,
    initialCode,
    theme: initialTheme = 'dark'
}) => {
    const [language, setLanguage] = useState<SupportedLanguage>('javascript');
    const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES['javascript']);
    const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState('testcases');

    useEffect(() => {
        logger.info(`Switching language to ${language}`);
        const template = DEFAULT_CODE_TEMPLATES[language];
        setCode(template);
    }, [language]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleRun = async (): Promise<ExecutionResult | null> => {
        if (isExecuting) {
            logger.warn("Execution blocked: Already executing");
            return null;
        }

        logger.info("Starting Code Execution", { language, questionId: question.id });
        setIsExecuting(true);
        setActiveTab('result');
        setExecutionResult(null);

        try {
            const result = await executeCode(language, code, question);
            logger.info("Execution Completed", { status: result.status, hasTestResults: !!result.testCaseResults?.length });
            setExecutionResult(result);
            return result;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            logger.error("Execution Failed", error);
            const errResult: ExecutionResult = {
                status: 'Runtime Error',
                output: message,
                executionTime: 0
            };
            setExecutionResult(errResult);
            return errResult;
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSubmit = async () => {
        logger.info("Submitting Solution", { language, questionId: question.id });
        setActiveTab('result');
        const result = await handleRun();
        if (onSolved && result?.status === 'Accepted') {
            onSolved(result);
        }
    };

    return (
        <div className={cn("h-screen w-full overflow-hidden flex flex-col font-sans antialiased bg-zinc-950", theme === 'dark' ? 'dark text-zinc-100' : 'text-zinc-900')}>
            {/* SaaS Header */}
            <header className="h-14 border-b border-border/40 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-golden flex items-center justify-center shadow-lg shadow-amber-500/10">
                            <Trophy className="h-4 w-4 text-white" />
                        </div>
                        <h1 className="font-display text-lg font-bold tracking-tight">
                            <span className="text-gradient-golden">DSA</span> OS
                        </h1>
                    </div>

                    <div className="h-6 w-px bg-zinc-800" />

                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-100 transition-colors">
                            <List className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-0.5 px-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-semibold text-zinc-400 px-2">Problem {question.id}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4 mr-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/30">
                            <Timer className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-[11px] font-bold text-zinc-400 tabular-nums">00:00:00</span>
                        </div>
                    </div>

                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all">
                        <LayoutGrid className="h-4 w-4" />
                    </Button>

                    <div className="h-8 w-8 rounded-full gradient-golden border-2 border-zinc-800 shadow-inner flex items-center justify-center text-[10px] font-bold text-white cursor-pointer hover:scale-105 transition-transform">
                        JD
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0">
                <ResizeLayout
                    leftPanel={<QuestionPanel question={question} />}
                    rightTopPanel={
                        <EditorPanel
                            language={language}
                            setLanguage={setLanguage}
                            code={code}
                            setCode={setCode}
                            theme={theme}
                            toggleTheme={toggleTheme}
                            onRun={handleRun}
                            onSubmit={handleSubmit}
                            isExecuting={isExecuting}
                        />
                    }
                    rightBottomPanel={
                        <ConsolePanel
                            testCases={question.examples}
                            executionResult={executionResult}
                            isExecuting={isExecuting}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    }
                />
            </div>
        </div>
    );
};
