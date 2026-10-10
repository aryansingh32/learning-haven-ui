/**
 * "Format code" for every editor language, entirely in the browser.
 *
 * JavaScript uses Monaco's own formatter. Python uses Ruff's formatter and
 * C++/C/Java use clang-format, both compiled to WebAssembly (@wasm-fmt). The
 * WebAssembly files are only downloaded the first time a learner formats that
 * language (~1.2 MB for Python, ~2.6 MB for clang-format, before compression),
 * then cached by the browser — no server round trip, works offline after that.
 */
import type { SupportedLanguage } from './types';

/** Languages Format is offered for. */
export const FORMATTABLE_LANGUAGES: SupportedLanguage[] = ['javascript', 'python', 'java', 'cpp', 'c'];

/** clang-format settings close to the starter code: 4-space indent, `public:` flush with the class. */
export const CLANG_STYLE: Record<'cpp' | 'c' | 'java', string> = {
  cpp: '{BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: 100, AccessModifierOffset: -4, AllowShortFunctionsOnASingleLine: Empty}',
  c: '{BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: 100, AllowShortFunctionsOnASingleLine: Empty}',
  java: '{BasedOnStyle: Google, IndentWidth: 4, ContinuationIndentWidth: 8, ColumnLimit: 100, AllowShortFunctionsOnASingleLine: Empty}',
};
const CLANG_FILE: Record<'cpp' | 'c' | 'java', string> = { cpp: 'main.cpp', c: 'main.c', java: 'Main.java' };

export class FormatError extends Error {}

let clangReady: Promise<typeof import('@wasm-fmt/clang-format/web')> | null = null;
let ruffReady: Promise<typeof import('@wasm-fmt/ruff_fmt/web')> | null = null;

async function loadClang() {
  clangReady ??= (async () => {
    const [mod, wasm] = await Promise.all([import('@wasm-fmt/clang-format/web'), import('@wasm-fmt/clang-format/clang-format.wasm?url')]);
    await mod.default(wasm.default);
    return mod;
  })().catch((e) => { clangReady = null; throw e; });
  return clangReady;
}

async function loadRuff() {
  ruffReady ??= (async () => {
    const [mod, wasm] = await Promise.all([import('@wasm-fmt/ruff_fmt/web'), import('@wasm-fmt/ruff_fmt/ruff_fmt_bg.wasm?url')]);
    await mod.default(wasm.default);
    return mod;
  })().catch((e) => { ruffReady = null; throw e; });
  return ruffReady;
}

/**
 * Format `code`. Returns null for JavaScript (Monaco formats it). Throws FormatError
 * with a learner-facing message when the code can't be parsed.
 */
export async function formatSource(language: SupportedLanguage, code: string): Promise<string | null> {
  if (language === 'javascript') return null;
  if (language === 'python') {
    const ruff = await loadRuff();
    try {
      return ruff.format(code, 'main.py', { indent_width: 4, line_width: 100 });
    } catch (e) {
      throw new FormatError(`Couldn't format: ${firstLine(e)}. Fix the syntax error and try again.`);
    }
  }
  const clang = await loadClang();
  try {
    return clang.format(code, CLANG_FILE[language], CLANG_STYLE[language]);
  } catch (e) {
    throw new FormatError(`Couldn't format this code: ${firstLine(e)}`);
  }
}

const firstLine = (e: unknown) => String(e instanceof Error ? e.message : e).split('\n')[0].slice(0, 200);
