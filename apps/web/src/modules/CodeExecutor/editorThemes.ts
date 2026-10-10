/**
 * Editor colour themes. Built-in Monaco themes plus a few popular ones defined
 * here with defineTheme. The ids are stored per learner (editor_preferences.theme),
 * so keep them stable; the API accepts exactly this list.
 */
import type * as Monaco from 'monaco-editor';

export interface EditorThemeOption {
  id: string;
  label: string;
  dark: boolean;
  /** Monaco theme name to pass to the editor (built-in or defined below). */
  monaco: string;
}

export const EDITOR_THEMES: EditorThemeOption[] = [
  { id: 'forge-dark', label: 'Forge Dark', dark: true, monaco: 'forge-dark' },
  { id: 'vs-dark', label: 'VS Dark', dark: true, monaco: 'vs-dark' },
  { id: 'light', label: 'VS Light', dark: false, monaco: 'vs' },
  { id: 'monokai', label: 'Monokai', dark: true, monaco: 'forge-monokai' },
  { id: 'dracula', label: 'Dracula', dark: true, monaco: 'forge-dracula' },
  { id: 'solarized-dark', label: 'Solarized Dark', dark: true, monaco: 'forge-solarized-dark' },
  { id: 'solarized-light', label: 'Solarized Light', dark: false, monaco: 'forge-solarized-light' },
  { id: 'github-light', label: 'GitHub Light', dark: false, monaco: 'forge-github-light' },
  { id: 'hc-black', label: 'High Contrast Dark', dark: true, monaco: 'hc-black' },
  { id: 'hc-light', label: 'High Contrast Light', dark: false, monaco: 'hc-light' },
];

export const DEFAULT_DARK_THEME = 'forge-dark';
export const DEFAULT_LIGHT_THEME = 'light';

export const findTheme = (id: string | undefined | null): EditorThemeOption | undefined => EDITOR_THEMES.find((t) => t.id === id);
export const isKnownTheme = (id: unknown): id is string => typeof id === 'string' && EDITOR_THEMES.some((t) => t.id === id);

type ThemeData = Monaco.editor.IStandaloneThemeData;
const rule = (token: string, foreground: string, fontStyle?: string) => ({ token, foreground, ...(fontStyle ? { fontStyle } : {}) });

const DEFINED: Record<string, ThemeData> = {
  'forge-dark': {
    base: 'vs-dark', inherit: true, rules: [],
    colors: { 'editor.background': '#09090b', 'editor.lineHighlightBackground': '#18181b', 'editorLineNumber.foreground': '#52525b' },
  },
  'forge-monokai': {
    base: 'vs-dark', inherit: true,
    rules: [
      rule('comment', '75715E', 'italic'), rule('string', 'E6DB74'), rule('number', 'AE81FF'), rule('keyword', 'F92672'),
      rule('type', '66D9EF', 'italic'), rule('identifier', 'F8F8F2'), rule('delimiter', 'F8F8F2'), rule('function', 'A6E22E'),
    ],
    colors: { 'editor.background': '#272822', 'editor.foreground': '#F8F8F2', 'editor.lineHighlightBackground': '#3E3D32', 'editorCursor.foreground': '#F8F8F0', 'editor.selectionBackground': '#49483E' },
  },
  'forge-dracula': {
    base: 'vs-dark', inherit: true,
    rules: [
      rule('comment', '6272A4', 'italic'), rule('string', 'F1FA8C'), rule('number', 'BD93F9'), rule('keyword', 'FF79C6'),
      rule('type', '8BE9FD', 'italic'), rule('identifier', 'F8F8F2'), rule('delimiter', 'F8F8F2'), rule('function', '50FA7B'),
    ],
    colors: { 'editor.background': '#282A36', 'editor.foreground': '#F8F8F2', 'editor.lineHighlightBackground': '#44475A', 'editorCursor.foreground': '#F8F8F2', 'editor.selectionBackground': '#44475A' },
  },
  'forge-solarized-dark': {
    base: 'vs-dark', inherit: true,
    rules: [
      rule('comment', '586E75', 'italic'), rule('string', '2AA198'), rule('number', 'D33682'), rule('keyword', '859900'),
      rule('type', 'B58900'), rule('identifier', '93A1A1'), rule('delimiter', '93A1A1'),
    ],
    colors: { 'editor.background': '#002B36', 'editor.foreground': '#93A1A1', 'editor.lineHighlightBackground': '#073642', 'editor.selectionBackground': '#274642' },
  },
  'forge-solarized-light': {
    base: 'vs', inherit: true,
    rules: [
      rule('comment', '93A1A1', 'italic'), rule('string', '2AA198'), rule('number', 'D33682'), rule('keyword', '859900'),
      rule('type', 'B58900'), rule('identifier', '586E75'), rule('delimiter', '586E75'),
    ],
    colors: { 'editor.background': '#FDF6E3', 'editor.foreground': '#586E75', 'editor.lineHighlightBackground': '#EEE8D5', 'editor.selectionBackground': '#E4DCC6' },
  },
  'forge-github-light': {
    base: 'vs', inherit: true,
    rules: [
      rule('comment', '6A737D', 'italic'), rule('string', '032F62'), rule('number', '005CC5'), rule('keyword', 'D73A49'),
      rule('type', '6F42C1'), rule('identifier', '24292E'), rule('delimiter', '24292E'),
    ],
    colors: { 'editor.background': '#FFFFFF', 'editor.foreground': '#24292E', 'editor.lineHighlightBackground': '#F6F8FA', 'editor.selectionBackground': '#C8E1FF' },
  },
};

/** Define the custom themes on a Monaco instance (safe to call more than once). */
export function defineEditorThemes(monaco: typeof Monaco): void {
  for (const [name, data] of Object.entries(DEFINED)) monaco.editor.defineTheme(name, data);
}
