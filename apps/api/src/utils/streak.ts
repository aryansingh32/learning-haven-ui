import { pool } from '../config/database';
import logger from '../config/logger';

/**
 * Update a user's streak, atomically.
 * Run when a chapter is unlocked/completed.
 *
 * Delegates to public.update_streak(), a single Postgres function that
 * locks the user row for the duration of the read-modify-write — a plain
 * JS-side read-then-write here would let two concurrent requests for the
 * same user (double-click, two tabs, a retried request) both read the same
 * starting streak and race on the write.
 */
export const updateStreak = async (userId: string) => {
    try {
        const { rows } = await pool.query('SELECT public.update_streak($1) AS streak', [userId]);
        return { streak: rows[0]?.streak ?? 0 };
    } catch (err) {
        logger.error('Update streak failed', err);
        return { streak: 0 };
    }
};
