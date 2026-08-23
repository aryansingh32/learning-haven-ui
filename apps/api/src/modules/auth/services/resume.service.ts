import { pool } from '../../../config/database';
import logger from '../../../config/logger';

export class ResumeService {
  /**
   * Load a user's resume data from the database.
   * Returns null if no resume exists yet.
   */
  static async load(userId: string): Promise<{ data: any; version: number } | null> {
    try {
      const result = await pool.query(
        `SELECT data, version FROM public.user_resumes WHERE user_id = $1`,
        [userId]
      );
      if (result.rows.length === 0) return null;
      return { data: result.rows[0].data, version: result.rows[0].version };
    } catch (error) {
      logger.error('Error loading resume:', { userId, error });
      throw new Error('Failed to load resume');
    }
  }

  /**
   * Save (upsert) a user's resume data.
   * Increments version on each save for audit trail awareness.
   */
  static async save(userId: string, data: any): Promise<{ version: number }> {
    try {
      const result = await pool.query(
        `INSERT INTO public.user_resumes (user_id, data, version)
         VALUES ($1, $2, 1)
         ON CONFLICT (user_id)
         DO UPDATE SET
           data = EXCLUDED.data,
           version = public.user_resumes.version + 1,
           updated_at = NOW()
         RETURNING version`,
        [userId, JSON.stringify(data)]
      );
      return { version: result.rows[0].version };
    } catch (error) {
      logger.error('Error saving resume:', { userId, error });
      throw new Error('Failed to save resume');
    }
  }
}
