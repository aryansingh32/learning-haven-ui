import React, { useEffect, useRef, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { QuestionData, SupportedLanguage } from './types';
import { useCodeExecution, type RunContext } from './hooks/useCodeExecution';
import type { CustomRunInput } from './customRun';
import { ResizeLayout } from './components/ResizeLayout';
import { QuestionPanel } from './components/QuestionPanel';
import { EditorPanel, type EditorPrefsSync } from './components/EditorPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { cn } from '@/lib/utils';

export type WorkspaceLayout = 'leetcode' | 'hackerrank';

export interface CodeWorkspaceProps {
    question: QuestionData;
    onSolved?: (stats: any) => void;
    initialCode?: string;
    initialLanguage?: SupportedLanguage;
    theme?: 'light' | 'dark';
    layout?: WorkspaceLayout;
    showHeader?: boolean;
    showQuestion?: boolean;
    showConsole?: boolean;
    showRun?: boolean;
    showSubmit?: boolean;
    allowLanguageSwitch?: boolean;
    resetCodeOnLanguageChange?: boolean;
    resetOnQuestionChange?: boolean;
    header?: React.ReactNode;
    className?: string;
    /** Replace the default question panel (e.g. with tabs for hints and solution). A function gets the live editor state. */
    questionPanel?: React.ReactNode | ((editor: WorkspaceEditorState) => React.ReactNode);
    languages?: SupportedLanguage[];
    onSubmit?: (code: string, language: SupportedLanguage) => Promise<import('./types').ExecutionResult>;
    /** Run on a server for some languages; return undefined to run in the browser. */
    onRun?: (code: string, language: SupportedLanguage, custom?: CustomRunInput) => Promise<import('./types').ExecutionResult> | undefined;
    /** After every Run, with what was run (e.g. to keep a run history). */
    onRunComplete?: (result: import('./types').ExecutionResult, ctx: RunContext) => void;
    /** Offer a "Custom input" console tab (function-style problems: the input is the arguments). */
    allowCustomInput?: boolean;
    /** Keep editor settings on the learner's account. */
    editorPrefsSync?: EditorPrefsSync;
    storageKey?: string;
}

export interface WorkspaceEditorState {
    code: string;
    language: SupportedLanguage;
    setCode: (code: string) => void;
    setLanguage: (language: SupportedLanguage) => void;
}

/** Phones and narrow windows get a stacked layout instead of resizable panels. */
function useNarrow(breakpoint = 768) {
    const query = `(max-width: ${breakpoint - 1}px)`;
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setNarrow(mql.matches);
        mql.addEventListener('change', onChange);
        onChange();
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return narrow;
}

const HackerrankTabs: React.FC = () => {
    return (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-emerald-500/10 bg-emerald-950/30">
            {['Problem', 'Editorial', 'Submissions'].map((label, idx) => (
                <div
                    key={label}
                    className={cn(
                        "text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full border",
                        idx === 0
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-transparent text-zinc-500 border-zinc-800/80"
                    )}
                >
                    {label}
                </div>
            ))}
        </div>
    );
};

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
    question,
    onSolved,
    initialCode,
    initialLanguage = 'javascript',
    theme: initialTheme = 'dark',
    layout = 'leetcode',
    showHeader = true,
    showQuestion = true,
    showConsole = true,
    showRun = true,
    showSubmit = true,
    allowLanguageSwitch = true,
    resetCodeOnLanguageChange = true,
    resetOnQuestionChange = true,
    header,
    className,
    questionPanel: customQuestionPanel,
    languages,
    onSubmit,
    onRun,
    onRunComplete,
    allowCustomInput = false,
    editorPrefsSync,
    storageKey,
}) => {
    const narrow = useNarrow();
    const consoleRef = useRef<HTMLDivElement>(null);
    const {
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
    } = useCodeExecution({
        question,
        initialLanguage,
        initialCode,
        initialTheme,
        resetCodeOnLanguageChange,
        resetOnQuestionChange,
        onSolved,
        onSubmit,
        onRun,
        onRunComplete,
        storageKey,
    });

    // On a phone the console sits below the editor: bring it into view when a run starts.
    const showConsoleOnPhone = () => { if (narrow) consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const run = () => { showConsoleOnPhone(); void handleRun(); };
    const submit = () => { showConsoleOnPhone(); void handleSubmit(); };
    const runCustom = (custom: CustomRunInput) => { void handleRun(custom); };

    const editorPanel = (
        <EditorPanel
            language={language}
            setLanguage={setLanguage}
            code={code}
            setCode={setCode}
            theme={theme}
            toggleTheme={toggleTheme}
            onRun={run}
            onSubmit={submit}
            isExecuting={isExecuting}
            onReset={resetCode}
            showRun={showRun}
            showSubmit={showSubmit}
            allowLanguageSwitch={allowLanguageSwitch}
            variant={layout}
            languages={languages}
            prefsSync={editorPrefsSync}
        />
    );

    const consolePanel = showConsole ? (
        <ConsolePanel
            testCases={question.examples}
            executionResult={executionResult}
            isExecuting={isExecuting}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onRunCustom={allowCustomInput ? runCustom : undefined}
            inputExample={question.examples[0]?.input}
        />
    ) : (
        <div className="h-full w-full bg-zinc-950" />
    );

    const customPanel = typeof customQuestionPanel === 'function'
        ? customQuestionPanel({ code, language, setCode, setLanguage })
        : customQuestionPanel;
    const questionPanel = showQuestion && customPanel ? customPanel : showQuestion ? (
        <div className="h-full flex flex-col">
            {layout === 'hackerrank' && <HackerrankTabs />}
            <QuestionPanel question={question} />
        </div>
    ) : null;

    const containerClass = cn(
        "w-full flex flex-col font-sans antialiased bg-zinc-950",
        narrow ? "min-h-screen overflow-x-hidden" : "h-screen overflow-hidden",
        theme === 'dark' ? 'dark text-zinc-100' : 'text-zinc-900',
        className
    );

    const renderLayout = () => {
        if (narrow) {
            // Stacked: statement, editor, console — the page scrolls, each part keeps a usable height.
            return (
                <div className="flex flex-col w-full">
                    {showQuestion && (
                        <section aria-label="Problem" className="h-[60svh] min-h-[320px] border-b border-border/50 overflow-hidden">
                            {questionPanel}
                        </section>
                    )}
                    <section aria-label="Code editor" className="h-[70svh] min-h-[360px] overflow-hidden">
                        {editorPanel}
                    </section>
                    {showConsole && (
                        <section ref={consoleRef} aria-label="Console" className="h-[75svh] min-h-[360px] overflow-hidden scroll-mt-2">
                            {consolePanel}
                        </section>
                    )}
                </div>
            );
        }
        if (showQuestion && showConsole) {
            return (
                <ResizeLayout
                    leftPanel={questionPanel}
                    rightTopPanel={editorPanel}
                    rightBottomPanel={consolePanel}
                    leftDefaultSize={layout === 'hackerrank' ? 45 : 40}
                    rightTopDefaultSize={layout === 'hackerrank' ? 70 : 65}
                    rightBottomDefaultSize={layout === 'hackerrank' ? 30 : 35}
                />
            );
        }

        if (showQuestion && !showConsole) {
            return (
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                    <ResizablePanel defaultSize={layout === 'hackerrank' ? 45 : 40} minSize={25}>
                        <div className="h-full w-full overflow-hidden border-r border-border/50 bg-card/30 backdrop-blur-sm">
                            {questionPanel}
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="w-1.5 bg-border/20 hover:bg-primary/30 transition-colors" />
                    <ResizablePanel defaultSize={layout === 'hackerrank' ? 55 : 60}>
                        <div className="h-full w-full overflow-hidden">
                            {editorPanel}
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            );
        }

        if (!showQuestion && showConsole) {
            return (
                <ResizablePanelGroup direction="vertical" className="h-full w-full">
                    <ResizablePanel defaultSize={70} minSize={30}>
                        <div className="h-full w-full overflow-hidden">
                            {editorPanel}
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="h-1.5 bg-border/20 hover:bg-primary/30 transition-colors" />
                    <ResizablePanel defaultSize={30} minSize={15}>
                        <div className="h-full w-full overflow-hidden">
                            {consolePanel}
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            );
        }

        return (
            <div className="h-full w-full overflow-hidden">
                {editorPanel}
            </div>
        );
    };

    return (
        <div className={containerClass}>
            {showHeader && (header || <WorkspaceHeader variant={layout} questionId={question.id} />)}
            <div className={cn("flex-1 flex flex-col", !narrow && "min-h-0")}>
                {renderLayout()}
            </div>
        </div>
    );
};
