import { Router } from 'express';
import { userOf } from '../auth';
import { z } from 'zod';
import { asSystem, asUser } from '../db';

export const meRouter = Router();

/**
 * Who am I in Campus? Also claims any roster pre-registrations for the
 * caller's verified email, so a student is attached on first sign-in.
 */
meRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const result = await asUser(userId, async (db) => {
    const claimed = await db.query<{ n: number }>(`select campus.claim_roster_entries() as n`);
    const memberships = await db.query(
      `select o.id as "orgId", o.name as "orgName", o.slug, o.type, o.logo_url as "logoUrl", o.brand_color as "brandColor",
              m.role, m.roll_number as "rollNumber", m.department_id as "departmentId",
              m.custom_role_id as "customRoleId", (select cr.name from campus.custom_roles cr where cr.id = m.custom_role_id) as "customRoleName",
              -- A custom role replaces the base role's permissions (same rule as campus.user_permissions).
              coalesce(case when m.custom_role_id is not null
                         then (select array(select unnest(cr.permissions) order by 1) from campus.custom_roles cr where cr.id = m.custom_role_id)
                         else (select array_agg(rp.permission order by rp.permission) from campus.role_permissions rp where rp.role = m.role) end,
                       '{}') as permissions
         from campus.org_memberships m
         join campus.organizations o on o.id = m.org_id
        where m.user_id = $1 and m.status = 'active' and o.status = 'active'
        order by o.name`,
      [userId]
    );
    const admin = await db.query<{ ok: boolean }>(`select campus.is_platform_admin() as ok`);
    return { claimed: claimed.rows[0].n, memberships: memberships.rows, isPlatformAdmin: admin.rows[0].ok };
  });
  // Colleges the caller belongs to that Forge has suspended or archived (only their names, so the
  // apps can say why the college is missing). The caller's own memberships only.
  const unavailableColleges = await asSystem(async (db) => (await db.query(
    `select o.name as "orgName", o.status, m.role
       from campus.org_memberships m join campus.organizations o on o.id = m.org_id
      where m.user_id = $1 and m.status = 'active' and o.status <> 'active' order by o.name`, [userId])).rows);
  res.json({ ...result, unavailableColleges });
});

// ── My notifications ────────────────────────────────────────────────────────
meRouter.get('/notifications', async (req, res) => {
  const userId = userOf(req);
  const unreadOnly = req.query.unread === '1';
  res.json(await asUser(userId, async (db) => {
    const rows = (await db.query(
      `select id, kind, title, body, link, read_at as "readAt", created_at as "createdAt", org_id as "orgId"
         from public.notifications where user_id = $1 and ($2::boolean is false or read_at is null)
        order by created_at desc limit 50`, [userId, unreadOnly])).rows;
    const unread = (await db.query<{ n: number }>(`select count(*)::int as n from public.notifications where user_id = $1 and read_at is null`, [userId])).rows[0].n;
    return { unread, rows };
  }));
});

const readBody = z.union([z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }), z.object({ all: z.literal(true) })]);

meRouter.post('/notifications/read', async (req, res) => {
  const userId = userOf(req);
  const body = readBody.parse(req.body);
  const n = await asUser(userId, async (db) => (await db.query(
    `update public.notifications set read_at = now() where user_id = $1 and read_at is null and ($2::uuid[] is null or id = any($2::uuid[]))`,
    [userId, 'ids' in body ? body.ids : null])).rowCount);
  res.json({ marked: n });
});

const KINDS = ['test_assigned', 'test_closing', 'result_released', 'feedback', 'course_assigned', 'course_due',
  'drive_announced', 'drive_update', 'job_alert', 'announcement', 'community_reply', 'team_request', 'team_update'] as const;
const prefsBody = z.object({
  emailEnabled: z.boolean().optional(),
  dailyDigest: z.boolean().optional(),
  mutedKinds: z.array(z.enum(KINDS)).max(KINDS.length).optional(),
});

meRouter.get('/notification-preferences', async (req, res) => {
  const userId = userOf(req);
  const row = await asUser(userId, async (db) => (await db.query(
    `select email_enabled as "emailEnabled", daily_digest as "dailyDigest", muted_kinds as "mutedKinds"
       from public.notification_preferences where user_id = $1`, [userId])).rows[0]);
  res.json(row ?? { emailEnabled: true, dailyDigest: false, mutedKinds: [] });
});

meRouter.put('/notification-preferences', async (req, res) => {
  const userId = userOf(req);
  const b = prefsBody.parse(req.body);
  res.json(await asUser(userId, async (db) => (await db.query(
    `insert into public.notification_preferences (user_id, email_enabled, daily_digest, muted_kinds)
     values ($1, coalesce($2::boolean, true), coalesce($3::boolean, false), coalesce($4::text[], '{}'))
     on conflict (user_id) do update set
       email_enabled = coalesce($2::boolean, notification_preferences.email_enabled),
       daily_digest = coalesce($3::boolean, notification_preferences.daily_digest),
       muted_kinds = coalesce($4::text[], notification_preferences.muted_kinds), updated_at = now()
     returning email_enabled as "emailEnabled", daily_digest as "dailyDigest", muted_kinds as "mutedKinds"`,
    [userId, b.emailEnabled ?? null, b.dailyDigest ?? null, b.mutedKinds ? [...new Set(b.mutedKinds)] : null])).rows[0]));
});
