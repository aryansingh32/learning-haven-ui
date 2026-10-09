import { pool } from '../../../config/database';
import logger from '../../../config/logger';
import { isMissingRelation } from './practiceRuns';

export interface HistoryEntry {
  id: string;
  language: string;
  code: string;
  verdict: string;
  passed: number;
  total: number;
  time_ms: number | null;
  memory_kb: number | null;
  created_at: string;
}

/** Every judged practice submission, per learner and problem (server-written). */
export class SubmissionHistoryService {
  static async record(entry: {
    userId: string; problemId: string; language: string; code: string;
    verdict: string; passed: number; total: number; timeMs: number; memoryKb?: number;
  }): Promise<void> {
    try {
      await pool.query(
        `insert into public.problem_submissions (user_id, problem_id, language, code, verdict, passed, total, time_ms, memory_kb)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [entry.userId, entry.problemId, entry.language, entry.code, entry.verdict, entry.passed, entry.total, entry.timeMs, entry.memoryKb ?? null],
      );
    } catch (err) {
      // History is a convenience: never fail a judged submission because of it.
      logger.error('Could not record submission history', { problemId: entry.problemId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  static async list(userId: string, problemId: string, limit = 30): Promise<HistoryEntry[]> {
    try {
      const { rows } = await pool.query(
        `select id, language, code, verdict, passed, total, time_ms, memory_kb, created_at
           from public.problem_submissions where user_id = $1 and problem_id = $2
          order by created_at desc limit $3`,
        [userId, problemId, limit],
      );
      return rows as HistoryEntry[];
    } catch (err) {
      // Table (or the memory column) not on this database yet: no history rather than an error.
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}
