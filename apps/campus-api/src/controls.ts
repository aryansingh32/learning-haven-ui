import { NextFunction, Request, Response } from 'express';
import { pool } from './db';
import { userOf } from './auth';
import { HttpError } from './errors';

/**
 * Forge admin controls that also apply here: suspended accounts (users.is_banned)
 * and module kill switches (feature_flags, kind 'kill_switch'). Read through a
 * short cache; if the database can't answer, the request goes through.
 */

const CACHE_MS = 15_000;
const bans = new Map<string, { banned: boolean; at: number }>();
let switches: { at: number; off: Set<string> } | null = null;

export async function rejectSuspended(req: Request, _res: Response, next: NextFunction) {
  const id = userOf(req);
  try {
    let hit = bans.get(id);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      const { rows } = await pool.query<{ is_banned: boolean | null }>('select is_banned from public.users where id = $1', [id]);
      hit = { banned: rows[0]?.is_banned === true, at: Date.now() };
      if (bans.size > 50_000) bans.clear();
      bans.set(id, hit);
    }
    if (hit.banned) return next(new HttpError(403, 'This account is suspended. Contact support if you think this is a mistake.'));
  } catch {
    // never lock everyone out over a lookup
  }
  next();
}

/** Refuses a module's requests while Forge staff have switched it off. */
export function moduleSwitch(key: string) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!switches || Date.now() - switches.at > CACHE_MS) {
        const { rows } = await pool.query<{ key: string }>(
          `select key from public.feature_flags where kind = 'kill_switch' and not enabled`);
        switches = { at: Date.now(), off: new Set(rows.map((r) => r.key)) };
      }
      if (switches.off.has(key)) return next(new HttpError(503, 'This part of Forge is switched off for a short while. Please try again later.'));
    } catch {
      // before the control-centre migration, or a lookup failure: leave it on
    }
    next();
  };
}

/** Drop the cached answers (tests). */
export function forgetControls() {
  bans.clear();
  switches = null;
}
