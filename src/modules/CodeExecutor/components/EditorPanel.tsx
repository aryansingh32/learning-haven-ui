import React from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Configure Monaco loader to use unpkg which might be more stable for workers
loader.config({
    paths: {
        vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
    }
});
import { Moon, Sun, Play, Send, RotateCcw, Settings, ChevronDown } from "lucide-react";
import { SupportedLanguage } from '../types';
import { LANGUAGE_OPTIONS } from '../constants';
import { cn } from "@/lib/utils";

interface EditorPanelProps {
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    code: string;
    setCode: (code: string) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    onRun: () => void;
    onSubmit: () => void;
    isExecuting: boolean;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
    language,
    setLanguage,
    code,
    setCode,
    theme,
    toggleTheme,
    onRun,
    onSubmit,
    isExecuting
}) => {
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        // Custom monaco theme setup could go here
        monaco.editor.defineTheme('learning-haven-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#09090b', // zinc-950
            }
        });
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-zinc-900/40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <Select value={language} onValueChange={(val) => setLanguage(val as SupportedLanguage)}>
                        <SelectTrigger className="w-[120px] h-7 bg-transparent border-none hover:bg-zinc-800/50 transition-colors text-xs font-semibold focus:ring-0">
                            <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 shadow-2xl">
                            {LANGUAGE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs focus:bg-zinc-800">{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="h-4 w-px bg-zinc-800 mx-1" />

                    <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50">
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Reset</span>
                    </Button>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md"
                    >
                        {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md"
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </Button>

                    <div className="w-px h-4 bg-zinc-800 mx-1" />

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onRun}
                        disabled={isExecuting}
                        className="h-7 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-200 text-[11px] font-bold px-3 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        {isExecuting ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                        ) : <Play className="h-3 w-3 fill-zinc-400 stroke-zinc-400" />}
                        Run
                    </Button>

                    <Button
                        size="sm"
                        onClick={onSubmit}
                        disabled={isExecuting}
                        className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 transition-all active:scale-95 shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                    >
                        <Send className="h-3 w-3" />
                        Submit
                    </Button>
                </div>
            </div>

            {/* Editor Container */}
            <div className="flex-1 relative overflow-hidden">
                <Editor
                    height="100%"
                    language={language === 'cpp' ? 'cpp' : language === 'java' ? 'java' : language === 'python' ? 'python' : 'javascript'}
                    value={code}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    loading={<div className="h-full w-full bg-zinc-950 animate-pulse" />}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 15,
                        lineHeight: 24,
                        padding: { top: 20 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontLigatures: true,
                        cursorSmoothCaretAnimation: "on",
                        smoothScrolling: true,
                        contextmenu: false,
                        renderLineHighlight: "all",
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        folding: true,
                        bracketPairColorization: { enabled: true },
                    }}
                    onChange={(value) => setCode(value || '')}
                    onMount={handleEditorDidMount}
                />
            </div>
        </div>
    );
};
