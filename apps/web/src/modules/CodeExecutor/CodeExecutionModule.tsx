import React from 'react';
import { QuestionData, SupportedLanguage } from './types';
import { CodeWorkspace, WorkspaceLayout } from './CodeWorkspace';

interface CodeExecutionModuleProps {
    question: QuestionData;
    onSolved?: (stats: any) => void;
    initialCode?: string;
    theme?: 'light' | 'dark';
    initialLanguage?: SupportedLanguage;
    layout?: WorkspaceLayout;
    showHeader?: boolean;
    showQuestion?: boolean;
    showConsole?: boolean;
    showRun?: boolean;
    showSubmit?: boolean;
    allowLanguageSwitch?: boolean;
    resetCodeOnLanguageChange?: boolean;
    resetOnQuestionChange?: boolean;
    className?: string;
}

export const CodeExecutionModule: React.FC<CodeExecutionModuleProps> = ({
    question,
    onSolved,
    initialCode,
    theme = 'dark',
    initialLanguage,
    layout = 'leetcode',
    showHeader = true,
    showQuestion = true,
    showConsole = true,
    showRun = true,
    showSubmit = true,
    allowLanguageSwitch = true,
    resetCodeOnLanguageChange = true,
    resetOnQuestionChange = true,
    className,
}) => {
    return (
        <CodeWorkspace
            question={question}
            onSolved={onSolved}
            initialCode={initialCode}
            initialLanguage={initialLanguage}
            theme={theme}
            layout={layout}
            showHeader={showHeader}
            showQuestion={showQuestion}
            showConsole={showConsole}
            showRun={showRun}
            showSubmit={showSubmit}
            allowLanguageSwitch={allowLanguageSwitch}
            resetCodeOnLanguageChange={resetCodeOnLanguageChange}
            resetOnQuestionChange={resetOnQuestionChange}
            className={className}
        />
    );
};
