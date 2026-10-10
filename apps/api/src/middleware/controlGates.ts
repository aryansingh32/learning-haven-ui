import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import logger from '../config/logger';
import { fail } from '../utils/api-response';
import { verifySupabaseAccessToken } from '../utils/supabaseJwt';
import { ControlCentre } from '../modules/core/services/controlCentre.service';

/**
 * Gates driven by the admin control centre: maintenance mode, module kill switches
 * and closed sign-ups. Each one lets the request through if the control state can't
 * be read — they exist to protect the product, never to take it down.
 */

// While maintenance is on, these keep working: health checks, the status the apps
// poll, signing in (so staff can get to the admin), the admin itself, payment,
// GitHub and WhatsApp webhooks (money and verification must not be lost) and scheduled jobs.
const MAINTENANCE_OPEN = [
    /^\/api\/health$/,
    /^\/api\/system\/status$/,
    /^\/api\/settings\/public$/,
    /^\/api\/auth\//,
    /^\/api\/admin(\/|$)/,
    /^\/api\/(v2\/)?payments\/webhook$/,
    /^\/api\/whatsapp\/webhook$/,
    /^\/api\/v1\/(apprenticeship|build)\/webhooks\//,
    /^\/api\/cron\//,
];

const roleCache = new Map<string, { role: string | null; at: number }>();
async function roleOf(userId: string): Promise<string | null> {
    const hit = roleCache.get(userId);
    if (hit && Date.now() - hit.at < 60_000) return hit.role;
    const { rows } = await pool.query<{ role: string }>(`select role from public.users where id = $1`, [userId]);
    const role = rows[0]?.role ?? null;
    if (roleCache.size > 10_000) roleCache.clear();
    roleCache.set(userId, { role, at: Date.now() });
    return role;
}

/** Whether the request carries a valid token of a Forge admin. */
async function isStaff(req: Request): Promise<boolean> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return false;
    const verified = verifySupabaseAccessToken(header.slice(7));
    if (!verified) return false;
    const role = await roleOf(verified.id);
    return role === 'admin' || role === 'super_admin';
}

export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
    try {
        const path = req.originalUrl.split('?')[0];
        if (!path.startsWith('/api/') || MAINTENANCE_OPEN.some((re) => re.test(path))) return next();
        const state = await ControlCentre.state();
        if (!state.maintenance || (await isStaff(req))) return next();
        res.setHeader('Retry-After', '300');
        return fail(res, 503, 'MAINTENANCE', state.maintenanceMessage);
    } catch (error) {
        logger.warn('Maintenance gate skipped', { error });
        return next();
    }
}

/**
 * Refuses a module's requests while its kill switch is off. `open` lists paths
 * (relative to where the router is mounted) that keep working, e.g. payment
 * confirmations for orders already paid.
 */
export function moduleGate(flagKey: string, open: RegExp[] = []) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (open.some((re) => re.test(req.path))) return next();
            if (await ControlCentre.moduleOn(flagKey)) return next();
            return fail(res, 503, 'MODULE_DISABLED', 'This part of Forge is switched off for a short while. Please try again later.');
        } catch (error) {
            logger.warn('Module gate skipped', { flagKey, error });
            return next();
        }
    };
}

/** Refuses new accounts while sign-ups are closed. */
export async function signupGate(_req: Request, res: Response, next: NextFunction) {
    try {
        if ((await ControlCentre.state()).signupsOpen) return next();
        return fail(res, 403, 'SIGNUPS_CLOSED', 'New sign-ups are paused right now. Please try again later.');
    } catch {
        return next();
    }
}
