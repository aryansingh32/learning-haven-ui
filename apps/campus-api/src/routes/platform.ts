import { Router } from 'express';
import { z } from 'zod';
import { collegeSlug } from '../collegeSlug';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { badRequest, forbidden, notFound } from '../errors';

/** Forge staff (platform admins) onboard colleges and appoint their owners. */
export const platformRouter = Router();

async function requirePlatformAdmin(userId: string) {
  const ok = await asUser(userId, async (db) => (await db.query<{ ok: boolean }>(`select campus.is_platform_admin() as ok`)).rows[0].ok);
  if (!ok) throw forbidden('Only Forge staff can manage colleges.');
}

const COLLEGE_SUMMARY = `
  select o.id, o.slug, o.name, o.status, o.seat_limit as "seatLimit", o.created_at as "createdAt",
         (select count(*) from campus.org_memberships m where m.org_id = o.id and m.role = 'student' and m.status = 'active')::int as students,
         (select count(*) from campus.org_memberships m where m.org_id = o.id and m.role <> 'student' and m.status = 'active')::int as staff,
         (select count(*) from campus.roster_entries r where r.org_id = o.id and r.status = 'pending')::int as "pendingRoster",
         (select u.email from campus.org_memberships m join public.users u on u.id = m.user_id
           where m.org_id = o.id and m.role = 'owner' order by m.joined_at limit 1) as "ownerEmail",
         (select count(*) from campus.assignments a where a.org_id = o.id and a.status = 'published')::int as assignments,
         (select count(*) from public.test_attempts t where t.org_id = o.id and t.started_at > now() - interval '30 days')::int as "attempts30d",
         (select max(l.created_at) from campus.audit_log l where l.org_id = o.id) as "lastActivityAt"
    from campus.organizations o`;

/** Every college with its plan (seats, status) and how much it is used. */
platformRouter.get('/colleges', async (req, res) => {
  const userId = userOf(req);
  await requirePlatformAdmin(userId);
  res.json(await asSystem(async (db) => (await db.query(`${COLLEGE_SUMMARY} where o.type = 'college' order by o.created_at desc`)).rows));
});

/** One college: summary, its staff, batches and licences. */
platformRouter.get('/colleges/:orgId', async (req, res) => {
  const userId = userOf(req);
  const orgId = z.string().uuid().parse(req.params.orgId);
  await requirePlatformAdmin(userId);
  const detail = await asSystem(async (db) => {
    const college = (await db.query(`${COLLEGE_SUMMARY} where o.id = $1 and o.type = 'college'`, [orgId])).rows[0];
    if (!college) return null;
    const staff = (await db.query(
      `select m.user_id as "userId", u.full_name as name, u.email, m.role, m.status
         from campus.org_memberships m join public.users u on u.id = m.user_id
        where m.org_id = $1 and m.role <> 'student' order by m.role, u.full_name`, [orgId])).rows;
    const batches = (await db.query(
      `select b.id, b.name, (select count(*) from campus.batch_members bm join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
                  where bm.batch_id = b.id and m.role = 'student' and m.status = 'active')::int as students
         from campus.batches b where b.org_id = $1 order by b.name`, [orgId])).rows;
    return { ...college, staffMembers: staff, batches };
  });
  if (!detail) throw notFound('College not found.');
  res.json(detail);
});

const collegePatch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  seatLimit: z.number().int().min(1).max(100_000).nullable().optional(),
  status: z.enum(['active', 'suspended', 'archived']).optional(),
}).strict();

/** Forge's controls over a college's plan: name, seats, and suspend / archive / reactivate. */
platformRouter.patch('/colleges/:orgId', async (req, res) => {
  const userId = userOf(req);
  const orgId = z.string().uuid().parse(req.params.orgId);
  const body = collegePatch.parse(req.body);
  await requirePlatformAdmin(userId);
  if (body.seatLimit) {
    const used = await asSystem(async (db) => (await db.query<{ n: number }>(
      `select count(*)::int as n from campus.org_memberships where org_id = $1 and role = 'student' and status = 'active'`, [orgId])).rows[0].n);
    if (body.seatLimit < used) throw badRequest(`This college already has ${used} active students. Remove some first, or choose at least ${used} seats.`);
  }
  const updated = await asUser(userId, async (db) => (await db.query(
    `update campus.organizations set
        name = coalesce($2, name),
        seat_limit = case when $3::boolean then $4::int else seat_limit end,
        status = coalesce($5, status),
        updated_at = now()
      where id = $1 and type = 'college' returning id`,
    [orgId, body.name ?? null, body.seatLimit !== undefined, body.seatLimit ?? null, body.status ?? null])).rows[0]);
  if (!updated) throw notFound('College not found.');
  res.json((await asSystem(async (db) => (await db.query(`${COLLEGE_SUMMARY} where o.id = $1`, [orgId])).rows[0])));
});

const collegeBody = z.object({
  name: z.string().trim().min(2).max(120),
  slug: collegeSlug,
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

// ── Course licences: a college's access to premium Forge courses ──────────────
const FORGE_ORG = '00000000-0000-0000-0000-00000000f0f0';

/** Premium Forge courses, to choose from when granting a licence. */
platformRouter.get('/courses', async (req, res) => {
  const userId = userOf(req);
  await requirePlatformAdmin(userId);
  res.json(await asSystem(async (db) => (await db.query(
    `select id, title, slug, coalesce(is_premium, false) as "isPremium"
       from public.courses where owner_org_id = $1 and deleted_at is null and is_published
      order by coalesce(is_premium, false) desc, order_index nulls last, title`, [FORGE_ORG])).rows));
});

platformRouter.get('/colleges/:orgId/licences', async (req, res) => {
  const userId = userOf(req);
  const orgId = z.string().uuid().parse(req.params.orgId);
  await requirePlatformAdmin(userId);
  const rows = await asUser(userId, async (db) => (await db.query<{ course_id: string | null }>(
    `select l.id, l.course_id, l.starts_at as "startsAt", l.ends_at as "endsAt", l.note, l.created_at as "createdAt",
            (l.starts_at <= now() and (l.ends_at is null or l.ends_at > now())) as active
       from campus.course_licences l where l.org_id = $1 order by l.created_at desc`, [orgId])).rows);
  const titles = new Map(await asSystem(async (db) => (await db.query<{ id: string; title: string }>(
    `select id, title from public.courses where id = any($1::uuid[])`,
    [rows.map((r) => r.course_id).filter(Boolean)])).rows.map((r) => [r.id, r.title] as [string, string])));
  res.json(rows.map(({ course_id, ...r }) => ({
    ...r, courseId: course_id, courseTitle: course_id ? titles.get(course_id) ?? null : null,
  })));
});

const licenceBody = z.object({
  courseId: z.string().uuid().nullable(),           // null = every premium Forge course
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

platformRouter.post('/colleges/:orgId/licences', async (req, res) => {
  const userId = userOf(req);
  const orgId = z.string().uuid().parse(req.params.orgId);
  const body = licenceBody.parse(req.body);
  await requirePlatformAdmin(userId);
  if (body.endsAt && body.endsAt <= (body.startsAt ?? new Date())) throw badRequest('The licence must end after it starts.');
  if (body.courseId) {
    const ok = await asSystem(async (db) => (await db.query(
      `select 1 from public.courses where id = $1 and owner_org_id = $2 and deleted_at is null`, [body.courseId, FORGE_ORG])).rowCount);
    if (!ok) throw badRequest('Only Forge courses can be licensed.');
  }
  const created = await asUser(userId, async (db) => (await db.query(
    `insert into campus.course_licences (org_id, course_id, starts_at, ends_at, note, created_by)
     values ($1, $2, coalesce($3, now()), $4, $5, $6) returning id`,
    [orgId, body.courseId, body.startsAt ?? null, body.endsAt ?? null, body.note ?? null, userId])).rows[0]);
  res.status(201).json(created);
});

platformRouter.delete('/colleges/:orgId/licences/:licenceId', async (req, res) => {
  const userId = userOf(req);
  const orgId = z.string().uuid().parse(req.params.orgId);
  const licenceId = z.string().uuid().parse(req.params.licenceId);
  await requirePlatformAdmin(userId);
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.course_licences where id = $1 and org_id = $2`, [licenceId, orgId])).rowCount);
  if (!n) throw notFound('Licence not found.');
  res.status(204).end();
});
