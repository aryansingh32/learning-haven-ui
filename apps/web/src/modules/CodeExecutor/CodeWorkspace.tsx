import React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { QuestionData, SupportedLanguage } from './types';
import { useCodeExecution } from './hooks/useCodeExecution';
import { ResizeLayout } from './components/ResizeLayout';
import { QuestionPanel } from './components/QuestionPanel';
import { EditorPanel } from './components/EditorPanel';
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
}) => {
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
    });

    const editorPanel = (
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
            onReset={resetCode}
            showRun={showRun}
            showSubmit={showSubmit}
            allowLanguageSwitch={allowLanguageSwitch}
            variant={layout}
        />
    );

    const consolePanel = showConsole ? (
        <ConsolePanel
            testCases={question.examples}
            executionResult={executionResult}
            isExecuting={isExecuting}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
        />
    ) : (
        <div className="h-full w-full bg-zinc-950" />
    );

    const questionPanel = showQuestion ? (
        <div className="h-full flex flex-col">
            {layout === 'hackerrank' && <HackerrankTabs />}
            <QuestionPanel question={question} />
        </div>
    ) : null;

    const containerClass = cn(
        "h-screen w-full overflow-hidden flex flex-col font-sans antialiased bg-zinc-950",
        theme === 'dark' ? 'dark text-zinc-100' : 'text-zinc-900',
        className
    );

    const renderLayout = () => {
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
            <div className="flex-1 flex flex-col min-h-0">
                {renderLayout()}
            </div>
        </div>
    );
};
