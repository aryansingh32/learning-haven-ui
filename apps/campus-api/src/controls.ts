import { NextFunction, Request, Response } from 'express';
import { pool } from './db';
import { userOf } from './auth';
import { HttpError } from './errors';
import { deviceIdOf, deviceInfoOf } from '@repo/assessment-core';
import type { ClientContext } from './services/attempts';

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
  recordDevice(id, req);
  next();
}

/** The device the browser reports (X-Device-Id / X-Device-Info) and the caller's IP. */
export function clientOf(req: Request): ClientContext {
  const deviceId = deviceIdOf(req.get('x-device-id'));
  return { deviceId, ip: req.ip ? req.ip.replace(/^::ffff:/, '') : null, info: deviceId ? deviceInfoOf(req.get('x-device-info'), req.get('user-agent')) : null };
}

const DEVICE_THROTTLE_MS = 10 * 60_000;
const seenDevices = new Map<string, number>();
/** Same record as the Forge API keeps (public.user_devices), at most every 10 minutes per device and IP. */
function recordDevice(userId: string, req: Request) {
  const c = clientOf(req);
  if (!c.deviceId) return;
  const key = `${userId}|${c.deviceId}|${c.ip}`;
  const last = seenDevices.get(key);
  if (last && Date.now() - last < DEVICE_THROTTLE_MS) return;
  if (seenDevices.size > 50_000) seenDevices.clear();
  seenDevices.set(key, Date.now());
  Promise.resolve()
    .then(() => pool.query(`select public.record_device($1, $2, $3::inet, $4, $5::jsonb)`,
      [userId, c.deviceId, c.ip, req.get('user-agent') ?? null, JSON.stringify(c.info)]))
    .catch(() => seenDevices.delete(key));
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
