import { Router } from 'express';
import { userOf } from '../auth';
import { asUser } from '../db';

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
              coalesce((select array_agg(rp.permission order by rp.permission)
                          from campus.role_permissions rp where rp.role = m.role), '{}') as permissions
         from campus.org_memberships m
         join campus.organizations o on o.id = m.org_id
        where m.user_id = $1 and m.status = 'active' and o.status = 'active'
        order by o.name`,
      [userId]
    );
    const admin = await db.query<{ ok: boolean }>(`select campus.is_platform_admin() as ok`);
    return { claimed: claimed.rows[0].n, memberships: memberships.rows, isPlatformAdmin: admin.rows[0].ok };
  });
  res.json(result);
});
