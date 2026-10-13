import { Request } from 'express';
import { deviceIdOf, deviceInfoOf } from '@repo/assessment-core';
import { pool } from '../../../config/database';
import logger from '../../../config/logger';

/**
 * Remembers which devices (browsers) an account is used from, with their IPs,
 * OS and browser (public.user_devices, via record_device). The browser sends
 * X-Device-Id / X-Device-Info; requests without them are not recorded. At most
 * one write per account, device and IP every THROTTLE_MS per process, and never
 * in the way of the request.
 */

const THROTTLE_MS = 10 * 60_000;
const recent = new Map<string, number>();

export function recordDevice(userId: string, req: Request): void {
    const deviceId = deviceIdOf(req.get?.('x-device-id'));
    if (!deviceId) return;
    const ip = req.ip ? req.ip.replace(/^::ffff:/, '') : null; // IPv4 as itself, not IPv4-in-IPv6
    const key = `${userId}|${deviceId}|${ip}`;
    const last = recent.get(key);
    if (last && Date.now() - last < THROTTLE_MS) return;
    if (recent.size > 50_000) recent.clear();
    recent.set(key, Date.now());
    const ua = req.get?.('user-agent') ?? null;
    const info = deviceInfoOf(req.get?.('x-device-info'), ua);
    Promise.resolve()
        .then(() => pool.query(`select public.record_device($1, $2, $3::inet, $4, $5::jsonb)`, [userId, deviceId, ip, ua, JSON.stringify(info)]))
        .catch((error: any) => {
            recent.delete(key);
            // Before the device migration the function doesn't exist; nothing to record.
            if (error?.code !== '42883') logger.debug('device not recorded', { code: error?.code, message: error?.message });
        });
}
