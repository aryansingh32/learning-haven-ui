import redis from '../../../config/redis';
import logger from '../../../config/logger';

/**
 * Signed-out sessions, for the access tokens they already handed out.
 *
 * Revoking a session deletes it from auth.sessions, so its refresh token stops
 * working at once. Its current access token is a self-contained JWT that stays
 * valid until it expires (Supabase default: 1 hour), so the API also refuses
 * tokens of sessions revoked here for that long: in this process (immediately)
 * and through Redis (other instances). A slow or absent Redis never blocks a
 * request: the check gives up after a short wait.
 */

const TTL_SECONDS = Number(process.env.SUPABASE_ACCESS_TOKEN_TTL_SECONDS) || 3600;
const REDIS_WAIT_MS = 150;
const key = (id: string) => `revoked-session:${id}`;
const local = new Map<string, number>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms).unref?.())]);
}

export async function markSessionsRevoked(ids: string[]): Promise<void> {
    const until = Date.now() + TTL_SECONDS * 1000;
    for (const id of ids) local.set(id, until);
    if (local.size > 50_000) for (const [id, t] of local) if (t < Date.now()) local.delete(id);
    try {
        await withTimeout(Promise.all(ids.map((id) => redis.set(key(id), '1', 'EX', TTL_SECONDS))), 500);
    } catch (error) {
        logger.warn('Could not share revoked sessions through Redis', { error });
    }
}

export async function isSessionRevoked(id: string | null | undefined): Promise<boolean> {
    if (!id) return false;
    const t = local.get(id);
    if (t && t > Date.now()) return true;
    try {
        return (await withTimeout(redis.get(key(id)), REDIS_WAIT_MS)) === '1';
    } catch {
        return false;
    }
}

/** True the first time this process sees a session (so its sign-in is recorded once, not per request). */
const seen = new Set<string>();
export function firstSighting(id: string): boolean {
    if (seen.has(id)) return false;
    if (seen.size > 50_000) seen.clear();
    seen.add(id);
    return true;
}
