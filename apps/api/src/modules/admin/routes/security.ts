import { Router } from 'express';
import { z } from 'zod';
import { describeDevice, parseUserAgent } from '@repo/assessment-core';
import { pool } from '../../../config/database';

/**
 * Devices and sign-ins, for Forge staff (mounted at /admin, behind requireAdmin):
 * every device an account is used from (OS, browser, IPs, first/last seen),
 * its recent sign-ins, and accounts that share a device or use unusually many.
 */
const router = Router();

const device = (r: any) => ({
  id: r.device_id.slice(0, 12),
  label: describeDevice({ os: r.os, osVersion: r.os_version, browser: r.browser, browserVersion: r.browser_version, deviceType: r.device_type }),
  os: r.os, osVersion: r.os_version, browser: r.browser, browserVersion: r.browser_version, deviceType: r.device_type,
  screen: r.screen, screens: r.screens, timezone: r.timezone, language: r.language,
  lastIp: r.last_ip, ips: r.ips ?? [], firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at, seenCount: r.seen_count,
});

router.get('/users/:id/devices', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(404).json({ error: 'User not found' });
  const [devices, signIns] = await Promise.all([
    pool.query(`select *, host(last_ip) as last_ip, array(select host(x) from unnest(ips) x) as ips
                  from public.user_devices where user_id = $1 order by last_seen_at desc limit 100`, [id.data])
      .catch((e) => (e?.code === '42P01' ? { rows: [] } : Promise.reject(e))),
    pool.query(`select occurred_at, regexp_replace(ip::text, '^::ffff:', '') as ip, user_agent, details from public.account_events
                 where user_id = $1 and kind = 'sign_in' order by occurred_at desc limit 50`, [id.data])
      .catch((e) => (e?.code === '42P01' ? { rows: [] } : Promise.reject(e))),
  ]);
  // Other accounts seen on the same devices (account sharing, impersonation).
  const ids = devices.rows.map((r: any) => r.device_id);
  const shared = ids.length ? (await pool.query(
    `select d.device_id, u.id, u.email, u.full_name from public.user_devices d join public.users u on u.id = d.user_id
      where d.device_id = any($1) and d.user_id <> $2 order by d.last_seen_at desc limit 50`, [ids, id.data])).rows : [];
  res.json({
    devices: devices.rows.map((r: any) => ({
      ...device(r),
      sharedWith: shared.filter((s: any) => s.device_id === r.device_id).map((s: any) => ({ id: s.id, email: s.email, name: s.full_name })),
    })),
    signIns: signIns.rows.map((r: any) => ({
      at: r.occurred_at, ip: r.ip, device: describeDevice(parseUserAgent(r.user_agent)), method: r.details?.method ?? null,
    })),
  });
});

router.get('/security/devices', async (_req, res) => {
  const run = (sql: string) => pool.query(sql).then((r) => r.rows).catch((e) => (e?.code === '42P01' ? [] : Promise.reject(e)));
  const [shared, many, totals] = await Promise.all([
    run(`select d.device_id, max(d.last_seen_at) as last_seen_at,
                jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'name', u.full_name, 'role', u.role) order by d.last_seen_at desc) as accounts,
                (array_agg(d.os order by d.last_seen_at desc))[1] as os, (array_agg(d.browser order by d.last_seen_at desc))[1] as browser,
                (array_agg(host(d.last_ip) order by d.last_seen_at desc))[1] as last_ip
           from public.user_devices d join public.users u on u.id = d.user_id
          group by d.device_id having count(*) > 1 order by count(*) desc, max(d.last_seen_at) desc limit 100`),
    run(`select u.id, u.email, u.full_name, count(*)::int as devices, count(distinct ip)::int as ips, max(d.last_seen_at) as last_seen_at
           from public.user_devices d join public.users u on u.id = d.user_id
           left join lateral unnest(d.ips) ip on true
          where d.last_seen_at > now() - interval '30 days'
          group by u.id having count(distinct d.device_id) >= 5 order by count(distinct d.device_id) desc limit 100`),
    run(`select count(*)::int as devices, count(distinct user_id)::int as accounts,
                count(*) filter (where last_seen_at > now() - interval '1 day')::int as active_today,
                jsonb_object_agg(coalesce(device_type, 'unknown'), n) as by_type
           from (select device_type, user_id, last_seen_at, count(*) over (partition by device_type) n from public.user_devices) x`),
  ]);
  res.json({
    totals: totals[0] ?? { devices: 0, accounts: 0, active_today: 0, by_type: {} },
    sharedDevices: shared.map((r: any) => ({ id: r.device_id.slice(0, 12), os: r.os, browser: r.browser, lastIp: r.last_ip, lastSeenAt: r.last_seen_at, accounts: r.accounts })),
    manyDevices: many.map((r: any) => ({ id: r.id, email: r.email, name: r.full_name, devices: r.devices, ips: r.ips, lastSeenAt: r.last_seen_at })),
  });
});

export default router;
