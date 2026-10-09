import { supabase } from '../../../config/database';
import logger from '../../../config/logger';

export interface HistoryEntry {
  id: string;
  language: string;
  code: string;
  verdict: string;
  passed: number;
  total: number;
  time_ms: number | null;
  created_at: string;
}

/** Every judged practice submission, per learner and problem (server-written). */
export class SubmissionHistoryService {
  static async record(entry: {
    userId: string; problemId: string; language: string; code: string;
    verdict: string; passed: number; total: number; timeMs: number;
  }): Promise<void> {
    const { error } = await supabase.from('problem_submissions').insert({
      user_id: entry.userId,
      problem_id: entry.problemId,
      language: entry.language,
      code: entry.code,
      verdict: entry.verdict,
      passed: entry.passed,
      total: entry.total,
      time_ms: entry.timeMs,
    });
    // History is a convenience: never fail a judged submission because of it.
    if (error) logger.error('Could not record submission history', { problemId: entry.problemId, error: error.message });
  }

  static async list(userId: string, problemId: string, limit = 30): Promise<HistoryEntry[]> {
    const { data, error } = await supabase
      .from('problem_submissions')
      .select('id, language, code, verdict, passed, total, time_ms, created_at')
      .eq('user_id', userId)
      .eq('problem_id', problemId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as HistoryEntry[];
  }
}
