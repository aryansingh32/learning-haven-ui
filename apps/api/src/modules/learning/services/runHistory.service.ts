import { pool } from '../../../config/database';
import logger from '../../../config/logger';
import { clip, DEFAULT_EDITOR_PREFS, EditorPrefs, isMissingRelation, MAX_RUN_OUTPUT, RunVerdict } from './practiceRuns';

export interface RunEntry {
  id: string;
  language: string;
  source: 'browser' | 'server';
  kind: 'examples' | 'custom';
  code: string;
  input: string | null;
  output: string | null;
  verdict: RunVerdict;
  passed: number;
  total: number;
  time_ms: number | null;
  memory_kb: number | null;
  created_at: string;
}

export interface NewRun {
  userId: string; problemId: string; language: string; source: 'browser' | 'server'; kind: 'examples' | 'custom';
  code: string; input?: string | null; output?: string | null; verdict: RunVerdict;
  passed: number; total: number; timeMs?: number | null; memoryKb?: number | null;
}

/**
 * The learner's recent "Run"s per problem (the database keeps the newest 25 per
 * problem and 500 per learner). History is a convenience: recording never fails a run.
 */
export class RunHistoryService {
  static async record(run: NewRun): Promise<boolean> {
    try {
      await pool.query(
        `insert into public.problem_runs (user_id, problem_id, language, source, kind, code, input, output, verdict, passed, total, time_ms, memory_kb)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [run.userId, run.problemId, run.language, run.source, run.kind, run.code, run.kind === 'custom' ? run.input : null,
          clip(run.output, MAX_RUN_OUTPUT), run.verdict, run.passed, run.total,
          run.timeMs == null ? null : Math.max(0, Math.min(600_000, Math.round(run.timeMs))), run.memoryKb ?? null],
      );
      return true;
    } catch (err) {
      if (!isMissingRelation(err)) logger.error('Could not record run history', { problemId: run.problemId, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /** Same as record, but swallows every error (used inside a run request). */
  static async recordQuietly(run: NewRun): Promise<void> {
    await RunHistoryService.record(run).catch(() => undefined);
  }

  static async list(userId: string, problemId: string, limit = 25): Promise<RunEntry[]> {
    try {
      const { rows } = await pool.query(
        `select id, language, source, kind, code, input, output, verdict, passed, total, time_ms, memory_kb, created_at
           from public.problem_runs where user_id = $1 and problem_id = $2
          order by created_at desc, id desc limit $3`,
        [userId, problemId, limit],
      );
      return rows as RunEntry[];
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}

/** Editor theme, font size and word wrap, one row per learner. */
export class EditorPrefsService {
  static async get(userId: string): Promise<EditorPrefs> {
    try {
      const { rows } = await pool.query('select theme, font_size, word_wrap from public.editor_preferences where user_id = $1', [userId]);
      return rows[0] ? { theme: rows[0].theme, font_size: Number(rows[0].font_size), word_wrap: rows[0].word_wrap } : DEFAULT_EDITOR_PREFS;
    } catch (err) {
      if (isMissingRelation(err)) return DEFAULT_EDITOR_PREFS;
      throw err;
    }
  }

  static async save(userId: string, prefs: Partial<EditorPrefs>): Promise<EditorPrefs> {
    const { rows } = await pool.query(
      `insert into public.editor_preferences (user_id, theme, font_size, word_wrap)
       values ($1, coalesce($2, 'forge-dark'), coalesce($3, 15), coalesce($4, false))
       on conflict (user_id) do update set
         theme = coalesce($2, public.editor_preferences.theme),
         font_size = coalesce($3, public.editor_preferences.font_size),
         word_wrap = coalesce($4, public.editor_preferences.word_wrap),
         updated_at = now()
       returning theme, font_size, word_wrap`,
      [userId, prefs.theme ?? null, prefs.font_size ?? null, prefs.word_wrap ?? null],
    );
    return { theme: rows[0].theme, font_size: Number(rows[0].font_size), word_wrap: rows[0].word_wrap };
  }
}
