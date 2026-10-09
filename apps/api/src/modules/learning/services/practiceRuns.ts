import { z } from 'zod';
import type { JudgeResult } from '../../execution/services/problemJudge.service';

/** Pure helpers for the practice workspace: run history, custom input runs, editor preferences. */

export const RUN_LANGUAGES = ['javascript', 'python', 'java', 'cpp'] as const;
export const RUN_VERDICTS = ['Accepted', 'Wrong Answer', 'Runtime Error', 'Compilation Error', 'Time Limit Exceeded', 'Ran'] as const;
export type RunVerdict = (typeof RUN_VERDICTS)[number];

export const MAX_CUSTOM_INPUT = 5000;
export const MAX_RUN_OUTPUT = 4000;

/** Postgres "table / column does not exist": the migration isn't applied on this database yet. */
export function isMissingRelation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === '42P01' || code === '42703';
}

/** Postgres "invalid input syntax" (e.g. a problem id that isn't a uuid) or a missing referenced row. */
export function isBadReference(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === '22P02' || code === '23503';
}

export const clip = (text: string | null | undefined, max: number): string | null =>
  text == null ? null : text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** A run the learner's browser did (JavaScript / Python in a web worker), reported for their history. */
export const browserRunSchema = z.object({
  language: z.enum(RUN_LANGUAGES),
  kind: z.enum(['examples', 'custom']),
  code: z.string().min(1).max(50_000),
  input: z.string().min(1).max(MAX_CUSTOM_INPUT).optional(),
  output: z.string().max(100_000).optional(),
  verdict: z.enum(RUN_VERDICTS),
  passed: z.number().int().min(0).max(100).default(0),
  total: z.number().int().min(0).max(100).default(0),
  time_ms: z.number().int().min(0).max(600_000).optional(),
}).refine((r) => r.passed <= r.total, { message: 'passed cannot exceed total' })
  .refine((r) => (r.kind === 'custom') === (r.input !== undefined), { message: 'A custom run needs its input (and only a custom run has one).' });
export type BrowserRun = z.infer<typeof browserRunSchema>;

/** Body of POST /problems/:id/run: the sample tests, or one custom input (with an optional expected output). */
export const runBodySchema = z.object({
  code: z.string().min(1, 'Write some code first.').max(50_000, 'Code exceeds the 50 KB limit.'),
  language: z.enum(RUN_LANGUAGES),
  input: z.string().trim().min(1, 'Type an input first.').max(MAX_CUSTOM_INPUT, `Custom input is limited to ${MAX_CUSTOM_INPUT} characters.`).optional(),
  expected: z.string().trim().max(MAX_CUSTOM_INPUT).optional(),
});

export interface CustomRunResult extends Omit<JudgeResult, 'verdict'> {
  verdict: RunVerdict;
  custom: { input: string; expected: string | null; output: string | null; error: string | null };
}

/**
 * Shape a one-test judge result for a custom input. Without an expected output there is
 * nothing to compare, so a clean run is "Ran" (output shown) rather than "Wrong Answer".
 */
export function shapeCustomRun(result: JudgeResult, input: string, expected: string | undefined): CustomRunResult {
  const t = result.tests[0];
  const output = t?.actual ?? null;
  const error = t?.error ?? (result.verdict === 'Compilation Error' || result.verdict === 'Time Limit Exceeded' || !t ? result.message ?? null : null);
  const hasExpected = Boolean(expected);
  let verdict: RunVerdict = result.verdict;
  if (!hasExpected && output !== null && !t?.error) verdict = 'Ran';
  return {
    ...result,
    verdict,
    passed: hasExpected ? result.passed : 0,
    total: hasExpected ? result.total : 0,
    custom: { input, expected: hasExpected ? expected! : null, output: clip(output, MAX_RUN_OUTPUT), error: clip(error, MAX_RUN_OUTPUT) },
  };
}

// ── Editor preferences ─────────────────────────────────────────────────────

/** Themes the editor offers (the web app defines each one for Monaco). */
export const EDITOR_THEMES = [
  'forge-dark', 'vs-dark', 'light', 'hc-black', 'hc-light', 'monokai', 'dracula', 'solarized-dark', 'solarized-light', 'github-light',
] as const;
export const editorPrefsSchema = z.object({
  theme: z.enum(EDITOR_THEMES).optional(),
  font_size: z.number().int().min(11).max(24).optional(),
  word_wrap: z.boolean().optional(),
}).refine((p) => p.theme !== undefined || p.font_size !== undefined || p.word_wrap !== undefined, { message: 'Nothing to save.' });
export type EditorPrefs = { theme: string; font_size: number; word_wrap: boolean };
export const DEFAULT_EDITOR_PREFS: EditorPrefs = { theme: 'forge-dark', font_size: 15, word_wrap: false };
