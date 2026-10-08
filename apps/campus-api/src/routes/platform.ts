import { Router } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { badRequest, forbidden } from '../errors';

/** Forge staff (platform admins) onboard colleges and appoint their owners. */
export const platformRouter = Router();

async function requirePlatformAdmin(userId: string) {
  const ok = await asUser(userId, async (db) => (await db.query<{ ok: boolean }>(`select campus.is_platform_admin() as ok`)).rows[0].ok);
  if (!ok) throw forbidden('Only Forge staff can manage colleges.');
}

platformRouter.get('/colleges', async (req, res) => {
  const userId = userOf(req);
  await requirePlatformAdmin(userId);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select o.id, o.slug, o.name, o.status, o.seat_limit as "seatLimit", o.created_at as "createdAt",
            (select count(*) from campus.org_memberships m where m.org_id = o.id and m.role = 'student' and m.status = 'active')::int as students,
            (select count(*) from campus.org_memberships m where m.org_id = o.id and m.role <> 'student' and m.status = 'active')::int as staff
       from campus.organizations o where o.type = 'college' order by o.created_at desc`
  )).rows));
});

const collegeBody = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Use lowercase letters, numbers and hyphens.'),
  ownerEmail: z.string().trim().toLowerCase().email(),
  seatLimit: z.number().int().min(1).max(100_000).nullable().optional(),
});

platformRouter.post('/colleges', async (req, res) => {
  const userId = userOf(req);
  const body = collegeBody.parse(req.body);
  await requirePlatformAdmin(userId);

  const owner = await asSystem(async (db) => (await db.query<{ id: string }>(
    `select id from public.users where lower(email) = $1`, [body.ownerEmail])).rows[0]);
  if (!owner) throw badRequest(`${body.ownerEmail} doesn't have a Forge account yet. Ask them to sign up first, then try again.`);

  const created = await asUser(userId, async (db) => {
    const org = (await db.query<{ id: string; slug: string; name: string }>(
      `insert into campus.organizations (name, slug, seat_limit, created_by) values ($1, $2, $3, $4) returning id, slug, name`,
      [body.name, body.slug, body.seatLimit ?? null, userId]
    )).rows[0];
    await db.query(
      `insert into campus.org_memberships (org_id, user_id, role, status, joined_at, invited_by) values ($1, $2, 'owner', 'active', now(), $3)`,
      [org.id, owner.id, userId]
    );
    return org;
  });
  res.status(201).json(created);
});
