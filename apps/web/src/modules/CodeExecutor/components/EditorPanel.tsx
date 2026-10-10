import React, { useEffect, useRef, useState } from 'react';
import Editor, { BeforeMount, OnMount, loader } from '@monaco-editor/react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Configure Monaco loader to use unpkg which might be more stable for workers
loader.config({
    paths: {
        vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
    }
});
import { Moon, Sun, Play, Send, RotateCcw, Settings, Maximize2, Minimize2, Minus, Plus, Wand2, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { SupportedLanguage } from '../types';
import { LANGUAGE_OPTIONS, DEFAULT_CODE_TEMPLATES } from '../constants';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, defineEditorThemes, EDITOR_THEMES, findTheme, isKnownTheme } from '../editorThemes';
import { FORMATTABLE_LANGUAGES, FormatError, formatSource } from '../formatters';

export interface EditorPrefs { fontSize: number; wordWrap: boolean; /** Editor theme id (see editorThemes); unset = follow the light/dark toggle. */ theme?: string }

/** Keep editor preferences on the learner's account (the practice workspace passes this). */
export interface EditorPrefsSync {
    load: () => Promise<Partial<EditorPrefs>>;
    save: (prefs: EditorPrefs) => Promise<unknown>;
}

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
    onReset?: () => void;
    showRun?: boolean;
    showSubmit?: boolean;
    allowLanguageSwitch?: boolean;
    variant?: 'leetcode' | 'hackerrank';
    /** Limit the language picker (defaults to every supported language). */
    languages?: SupportedLanguage[];
    /** Offer a full-screen toggle (off in proctored exams, where leaving full screen counts). */
    allowFullscreen?: boolean;
    prefsSync?: EditorPrefsSync;
}

const PREFS_KEY = 'forge-editor-prefs';
const DEFAULT_PREFS: EditorPrefs = { fontSize: 15, wordWrap: false };
const clampFont = (n: number) => Math.min(24, Math.max(11, Math.round(n)));

/** Font size, word wrap and theme: remembered in this browser, and on the account when `sync` is given. */
function useEditorPrefs(sync?: EditorPrefsSync): [EditorPrefs, (p: Partial<EditorPrefs>) => void] {
    const [prefs, setPrefs] = useState<EditorPrefs>(() => {
        try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return DEFAULT_PREFS; }
    });
    const syncRef = useRef(sync);
    syncRef.current = sync;
    const saveTimer = useRef<ReturnType<typeof setTimeout>>();
    const remember = (next: EditorPrefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ } };

    // The account's settings win over this browser's once they arrive.
    const hasSync = Boolean(sync);
    useEffect(() => {
        if (!hasSync) return;
        let live = true;
        syncRef.current!.load().then((server) => {
            if (!live || !server) return;
            setPrefs((prev) => {
                const next: EditorPrefs = {
                    fontSize: typeof server.fontSize === 'number' ? clampFont(server.fontSize) : prev.fontSize,
                    wordWrap: typeof server.wordWrap === 'boolean' ? server.wordWrap : prev.wordWrap,
                    theme: isKnownTheme(server.theme) ? server.theme : prev.theme,
                };
                remember(next);
                return next;
            });
        }).catch(() => undefined);
        return () => { live = false; };
    }, [hasSync]);
    useEffect(() => () => clearTimeout(saveTimer.current), []);

    const update = (p: Partial<EditorPrefs>) => setPrefs((prev) => {
        const next = { ...prev, ...p, fontSize: clampFont(p.fontSize ?? prev.fontSize) };
        remember(next);
        if (syncRef.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                syncRef.current?.save(next).catch(() => toast.error("Couldn't save your editor settings to your account. They're kept in this browser."));
            }, 400);
        }
        return next;
    });
    return [prefs, update];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const MONACO_LANG: Record<SupportedLanguage, string> = {
    javascript: 'javascript',
    python: 'python',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
};

// Monaco has no formatter for these; ours run in the browser (WebAssembly).
let formattersRegistered = false;
const registerFormatters: BeforeMount = (monaco) => {
    defineEditorThemes(monaco);
    if (formattersRegistered) return;
    formattersRegistered = true;
    for (const lang of ['python', 'java', 'cpp', 'c'] as const) {
        monaco.languages.registerDocumentFormattingEditProvider(MONACO_LANG[lang], {
            displayName: lang === 'python' ? 'Ruff' : 'clang-format',
            provideDocumentFormattingEdits: async (model) => {
                try {
                    const formatted = await formatSource(lang, model.getValue());
                    if (formatted == null || formatted === model.getValue()) return [];
                    return [{ range: model.getFullModelRange(), text: formatted }];
                } catch (e) {
                    toast.error(e instanceof FormatError ? e.message : "Couldn't load the formatter. Check your connection and try again.");
                    return [];
                }
            },
        });
    }
};

export const EditorPanel: React.FC<EditorPanelProps> = ({
    language,
    setLanguage,
    code,
    setCode,
    theme,
    toggleTheme,
    onRun,
    onSubmit,
    isExecuting,
    onReset,
    showRun = true,
    showSubmit = true,
    allowLanguageSwitch = true,
    variant = 'leetcode',
    languages,
    allowFullscreen = true,
    prefsSync,
}) => {
    const [prefs, setPrefs] = useEditorPrefs(prefsSync);
    const rootRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [formatting, setFormatting] = useState(false);
    // Shortcuts are registered once at mount; refs keep them calling the latest handlers.
    const runRef = useRef(onRun);
    const submitRef = useRef(onSubmit);
    runRef.current = showRun && !isExecuting ? onRun : () => undefined;
    submitRef.current = showSubmit && !isExecuting ? onSubmit : () => undefined;

    const editorTheme = findTheme(prefs.theme) ?? findTheme(theme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME)!;

    useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);
    const toggleFullscreen = () => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    };
    const canFormat = FORMATTABLE_LANGUAGES.includes(language);
    const format = async () => {
        const action = editorRef.current?.getAction('editor.action.formatDocument');
        if (!action) return;
        setFormatting(true);
        try { await action.run(); } finally { setFormatting(false); }
    };
    const switchLightDark = () => {
        setPrefs({ theme: editorTheme.dark ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME });
        toggleTheme();
    };
    const toolbarClass = variant === 'hackerrank'
        ? "bg-emerald-950/40 border-emerald-500/10"
        : "bg-zinc-900/40 border-border/40";
    const editorBgClass = variant === 'hackerrank' ? "bg-zinc-950" : "bg-zinc-950";

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => submitRef.current());
    };

    return (
        <div ref={rootRef} className={`flex flex-col h-full ${editorBgClass}`}>
            {/* Header / Toolbar */}
            <div className={`flex flex-wrap items-center justify-between gap-y-1 px-2 sm:px-3 py-1.5 border-b backdrop-blur-md ${toolbarClass}`}>
                <div className="flex items-center gap-1 sm:gap-2">
                    <Select value={language} onValueChange={(val) => setLanguage(val as SupportedLanguage)} disabled={!allowLanguageSwitch}>
                        <SelectTrigger aria-label="Language" className="w-[104px] sm:w-[120px] h-7 bg-transparent border-none text-zinc-200 hover:bg-zinc-800/50 transition-colors text-xs font-semibold focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 shadow-2xl">
                            {LANGUAGE_OPTIONS.filter(opt => !languages || languages.includes(opt.value)).map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs focus:bg-zinc-800">{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="h-4 w-px bg-zinc-800 mx-0.5 sm:mx-1" />

                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Reset code"
                        className="h-7 px-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        onClick={() => (onReset ? onReset() : setCode(DEFAULT_CODE_TEMPLATES[language]))}
                    >
                        <RotateCcw className="h-3 w-3 sm:mr-1.5" />
                        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Reset</span>
                    </Button>
                    {canFormat && (
                        <Button variant="ghost" size="sm" onClick={() => void format()} disabled={formatting} aria-label="Format code"
                            title={`Format code (Shift + Alt + F)`}
                            className="h-7 px-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50">
                            {formatting ? <Loader2 className="h-3 w-3 sm:mr-1.5 animate-spin" /> : <Wand2 className="h-3 w-3 sm:mr-1.5" />}
                            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Format</span>
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={switchLightDark}
                        aria-label={editorTheme.dark ? 'Switch to a light editor theme' : 'Switch to a dark editor theme'}
                        className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md"
                    >
                        {editorTheme.dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Editor settings"
                                className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md">
                                <Settings className="h-3.5 w-3.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 max-w-[calc(100vw-2rem)] bg-zinc-900 border-zinc-800 text-zinc-200 space-y-4">
                            <label className="flex items-center justify-between gap-3 text-xs font-semibold">
                                Theme
                                <select
                                    aria-label="Editor theme"
                                    value={editorTheme.id}
                                    onChange={(e) => setPrefs({ theme: e.target.value })}
                                    className="h-8 min-w-0 flex-1 max-w-[150px] rounded-md bg-zinc-800 border border-zinc-700 px-2 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    <optgroup label="Dark">
                                        {EDITOR_THEMES.filter((t) => t.dark).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </optgroup>
                                    <optgroup label="Light">
                                        {EDITOR_THEMES.filter((t) => !t.dark).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </optgroup>
                                </select>
                            </label>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">Font size</span>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Smaller text" onClick={() => setPrefs({ fontSize: prefs.fontSize - 1 })}><Minus className="h-3.5 w-3.5" /></Button>
                                    <span className="w-8 text-center text-xs tabular-nums" aria-live="polite">{prefs.fontSize}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Bigger text" onClick={() => setPrefs({ fontSize: prefs.fontSize + 1 })}><Plus className="h-3.5 w-3.5" /></Button>
                                </div>
                            </div>
                            <label className="flex items-center justify-between text-xs font-semibold">
                                Word wrap
                                <Switch checked={prefs.wordWrap} onCheckedChange={(v) => setPrefs({ wordWrap: v })} aria-label="Word wrap" />
                            </label>
                            {prefsSync && <p className="text-[11px] text-zinc-500">Saved to your account, so they follow you to other devices.</p>}
                            <div className="space-y-1 border-t border-zinc-800 pt-3 text-[11px] text-zinc-400">
                                <p className="font-semibold text-zinc-300">Shortcuts</p>
                                {showRun && <p className="flex justify-between"><span>Run</span><kbd className="font-mono">{MOD} + Enter</kbd></p>}
                                {showSubmit && <p className="flex justify-between"><span>Submit</span><kbd className="font-mono">{MOD} + Shift + Enter</kbd></p>}
                                {canFormat && <p className="flex justify-between"><span>Format</span><kbd className="font-mono">Shift + Alt + F</kbd></p>}
                                <p className="flex justify-between"><span>Find</span><kbd className="font-mono">{MOD} + F</kbd></p>
                                <p className="flex justify-between"><span>Comment line</span><kbd className="font-mono">{MOD} + /</kbd></p>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {allowFullscreen && (
                        <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen editor'}
                            className="h-7 w-7 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md">
                            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        </Button>
                    )}

                    <div className="w-px h-4 bg-zinc-800 mx-0.5 sm:mx-1" />

                    {showRun && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onRun}
                            disabled={isExecuting}
                            className="h-7 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-200 text-[11px] font-bold px-2.5 sm:px-3 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            {isExecuting ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                            ) : <Play className="h-3 w-3 fill-zinc-400 stroke-zinc-400" />}
                            Run
                        </Button>
                    )}

                    {showSubmit && (
                        <Button
                            size="sm"
                            onClick={onSubmit}
                            disabled={isExecuting}
                            className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 sm:px-3 transition-all active:scale-95 shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                        >
                            <Send className="h-3 w-3" />
                            Submit
                        </Button>
                    )}
                </div>
            </div>

            {/* Editor Container */}
            <div className="flex-1 relative overflow-hidden">
                <Editor
                    height="100%"
                    language={MONACO_LANG[language]}
                    value={code}
                    theme={editorTheme.monaco}
                    loading={<div className="h-full w-full bg-zinc-950 animate-pulse" />}
                    options={{
                        minimap: { enabled: false },
                        fontSize: prefs.fontSize,
                        lineHeight: Math.round(prefs.fontSize * 1.6),
                        wordWrap: prefs.wordWrap ? 'on' : 'off',
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
                    beforeMount={registerFormatters}
                    onChange={(value) => setCode(value || '')}
                    onMount={handleEditorDidMount}
                />
            </div>
        </div>
    );
};
