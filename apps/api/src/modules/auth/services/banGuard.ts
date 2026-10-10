import { pool } from '../../../config/database';
import logger from '../../../config/logger';

/**
 * Suspended accounts. An admin's ban (users.is_banned) used to be recorded and
 * never checked; the API now refuses a banned learner's requests. Looked up at
 * most every CACHE_MS per learner and process; a ban made from this process
 * applies at once, from another within CACHE_MS. If the lookup fails the request
 * goes through (a database hiccup must not lock everyone out).
 */

const CACHE_MS = 30_000;
const cache = new Map<string, { banned: boolean; at: number }>();

export async function isBanned(userId: string): Promise<boolean> {
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.banned;
    try {
        const { rows } = await pool.query<{ is_banned: boolean | null }>(`select is_banned from public.users where id = $1`, [userId]);
        const banned = rows[0]?.is_banned === true;
        if (cache.size > 50_000) cache.clear();
        cache.set(userId, { banned, at: Date.now() });
        return banned;
    } catch (error) {
        logger.warn('Ban check skipped', { userId, error });
        return false;
    }
}

/** Forget cached ban state (after an admin bans or restores accounts). */
export function forgetBans(userIds: string[]) {
    for (const id of userIds) cache.delete(id);
}
