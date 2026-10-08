import { Router } from 'express';
import { z } from 'zod';
import { parseRoster, RosterRow } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser, Db } from '../db';
import { badRequest, notFound } from '../errors';
import { requirePermission } from '../permissions';

export const orgRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

/** Names and emails for user ids that RLS has already shown the caller. */
async function people(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { fullName: string | null; email: string }>();
  return asSystem(async (db) => {
    const { rows } = await db.query<{ id: string; full_name: string | null; email: string }>(
      `select id, full_name, email from public.users where id = any($1::uuid[])`, [userIds]
    );
    return new Map(rows.map((r) => [r.id, { fullName: r.full_name, email: r.email }]));
  });
}

// ── Organisation & branding ─────────────────────────────────────────────────
orgRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const org = await asUser(userId, async (db) => {
    const { rows } = await db.query(
      `select id, slug, name, type, logo_url as "logoUrl", brand_color as "brandColor", email_domains as "emailDomains",
              seat_limit as "seatLimit", status,
              (select count(*) from campus.org_memberships m where m.org_id = o.id and m.role = 'student' and m.status = 'active')::int as "activeStudents"
         from campus.organizations o where id = $1`,
      [orgIdOf(req)]
    );
    return rows[0];
  });
  if (!org) throw notFound('College not found.');
  res.json(org);
});

const brandingBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  emailDomains: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i)).max(10).optional(),
});

orgRouter.patch('/branding', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = brandingBody.parse(req.body);
  await requirePermission(userId, orgId, 'org.manage');
  const updated = await asUser(userId, async (db) => {
    const { rows } = await db.query(
      `update campus.organizations set
          name = coalesce($2, name),
          logo_url = case when $3::boolean then $4 else logo_url end,
          brand_color = case when $5::boolean then $6 else brand_color end,
          email_domains = coalesce($7, email_domains)
        where id = $1 returning id, name, logo_url as "logoUrl", brand_color as "brandColor", email_domains as "emailDomains"`,
      [orgId, body.name ?? null, body.logoUrl !== undefined, body.logoUrl ?? null,
       body.brandColor !== undefined, body.brandColor ?? null, body.emailDomains?.map((d) => d.toLowerCase()) ?? null]
    );
    return rows[0];
  });
  res.json(updated);
});

// ── Departments ─────────────────────────────────────────────────────────────
orgRouter.get('/departments', async (req, res) => {
  const userId = userOf(req);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select id, name, code from campus.departments where org_id = $1 order by name`, [orgIdOf(req)]
  )).rows));
});

const departmentBody = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(1).max(20) });

orgRouter.post('/departments', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = departmentBody.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.departments (org_id, name, code) values ($1, $2, upper($3)) returning id, name, code`,
    [orgId, body.name, body.code]
  )).rows[0]));
});

// ── Batches ─────────────────────────────────────────────────────────────────
orgRouter.get('/batches', async (req, res) => {
  const userId = userOf(req);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select b.id, b.name, b.academic_year as "academicYear", b.graduation_year as "graduationYear", b.status,
            b.department_id as "departmentId", d.name as "departmentName",
            (select count(*) from campus.batch_members bm where bm.batch_id = b.id)::int as "studentCount"
       from campus.batches b left join campus.departments d on d.id = b.department_id
      where b.org_id = $1 order by b.status, b.name`,
    [orgIdOf(req)]
  )).rows));
});

const batchBody = z.object({
  name: z.string().trim().min(1).max(120),
  departmentId: uuid.nullable().optional(),
  academicYear: z.string().trim().max(20).nullable().optional(),
  graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
});

orgRouter.post('/batches', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = batchBody.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.batches (org_id, name, department_id, academic_year, graduation_year)
     values ($1, $2, $3, $4, $5) returning id, name`,
    [orgId, body.name, body.departmentId ?? null, body.academicYear ?? null, body.graduationYear ?? null]
  )).rows[0]));
});

orgRouter.get('/batches/:batchId/members', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const rows = await asUser(userId, async (db) => (await db.query<{ user_id: string; roll_number: string | null }>(
    `select bm.user_id, m.roll_number
       from campus.batch_members bm
       join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
      where bm.org_id = $1 and bm.batch_id = $2
      order by m.roll_number nulls last`,
    [orgId, uuid.parse(req.params.batchId)]
  )).rows);
  const names = await people(rows.map((r) => r.user_id));
  res.json(rows.map((r) => ({ userId: r.user_id, rollNumber: r.roll_number, ...names.get(r.user_id) })));
});

const batchMembersBody = z.object({ userIds: z.array(uuid).min(1).max(1000) });

orgRouter.post('/batches/:batchId/members', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const { userIds } = batchMembersBody.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  const added = await asUser(userId, async (db) => (await db.query(
    `insert into campus.batch_members (batch_id, org_id, user_id)
     select $2, $1, unnest($3::uuid[]) on conflict do nothing`,
    [orgId, uuid.parse(req.params.batchId), userIds]
  )).rowCount);
  res.json({ added });
});

orgRouter.delete('/batches/:batchId/members/:memberId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'batches.manage');
  await asUser(userId, (db) => db.query(
    `delete from campus.batch_members where org_id = $1 and batch_id = $2 and user_id = $3`,
    [orgId, uuid.parse(req.params.batchId), uuid.parse(req.params.memberId)]
  ));
  res.status(204).end();
});

// ── Members ─────────────────────────────────────────────────────────────────
orgRouter.get('/members', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const role = typeof req.query.role === 'string' ? req.query.role : null;
  const rows = await asUser(userId, async (db) => (await db.query<{
    user_id: string; role: string; status: string; roll_number: string | null; department: string | null; batches: string[] | null;
  }>(
    `select m.user_id, m.role, m.status, m.roll_number, d.name as department,
            (select array_agg(b.name order by b.name) from campus.batch_members bm
               join campus.batches b on b.id = bm.batch_id where bm.org_id = m.org_id and bm.user_id = m.user_id) as batches
       from campus.org_memberships m left join campus.departments d on d.id = m.department_id
      where m.org_id = $1 and ($2::text is null or m.role::text = $2)
      order by m.role, m.roll_number nulls last`,
    [orgId, role]
  )).rows);
  const names = await people(rows.map((r) => r.user_id));
  res.json(rows.map((r) => ({
    userId: r.user_id, role: r.role, status: r.status, rollNumber: r.roll_number,
    department: r.department, batches: r.batches ?? [], ...names.get(r.user_id),
  })));
});

const memberPatch = z.object({
  role: z.enum(['admin', 'placement_officer', 'faculty', 'evaluator', 'invigilator', 'student']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  rollNumber: z.string().trim().max(40).nullable().optional(),
});

orgRouter.patch('/members/:memberId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = memberPatch.parse(req.body);
  const memberId = uuid.parse(req.params.memberId);
  if (memberId === userId && (body.role || body.status)) throw badRequest('You cannot change your own role or status.');
  await requirePermission(userId, orgId, 'members.manage');
  const updated = await asUser(userId, async (db) => (await db.query(
    `update campus.org_memberships set
        role = coalesce($3::campus.org_role, role),
        status = coalesce($4::campus.member_status, status),
        roll_number = case when $5::boolean then $6 else roll_number end
      where org_id = $1 and user_id = $2 returning user_id`,
    [orgId, memberId, body.role ?? null, body.status ?? null, body.rollNumber !== undefined, body.rollNumber ?? null]
  )).rowCount);
  if (!updated) throw notFound('Member not found, or you cannot change them.');
  res.json({ ok: true });
});

// ── Roster: preview, then import ────────────────────────────────────────────
const rosterBody = z.object({ csv: z.string().min(1).max(2_000_000) });

interface ResolvedRow extends RosterRow { departmentId: string | null; batchId: string | null; existing: 'pending' | 'claimed' | null }

/**
 * Validate a roster file against this college: department codes and batch
 * names must exist, and we report who is already registered. Nothing is written.
 */
async function resolveRoster(db: Db, orgId: string, csv: string) {
  const { rows, errors } = parseRoster(csv);
  const depts = (await db.query<{ id: string; code: string; name: string }>(
    `select id, code, name from campus.departments where org_id = $1`, [orgId])).rows;
  const batches = (await db.query<{ id: string; name: string }>(
    `select id, name from campus.batches where org_id = $1 and status = 'active'`, [orgId])).rows;
  const existing = new Map((await db.query<{ email: string; status: 'pending' | 'claimed' }>(
    `select email, status from campus.roster_entries where org_id = $1 and email = any($2::text[])`,
    [orgId, rows.map((r) => r.email)])).rows.map((r) => [r.email, r.status]));

  const resolved: ResolvedRow[] = [];
  for (const row of rows) {
    const dept = row.department
      ? depts.find((d) => d.code.toLowerCase() === row.department!.toLowerCase() || d.name.toLowerCase() === row.department!.toLowerCase())
      : null;
    if (row.department && !dept) {
      errors.push({ line: row.line, message: `Department "${row.department}" does not exist. Create it first or fix the spelling.` });
      continue;
    }
    const batch = row.batch ? batches.find((b) => b.name.toLowerCase() === row.batch!.toLowerCase()) : null;
    if (row.batch && !batch) {
      errors.push({ line: row.line, message: `Batch "${row.batch}" does not exist. Create it first or fix the spelling.` });
      continue;
    }
    resolved.push({ ...row, departmentId: dept?.id ?? null, batchId: batch?.id ?? null, existing: existing.get(row.email) ?? null });
  }
  errors.sort((a, b) => a.line - b.line);
  return { rows: resolved, errors };
}

orgRouter.post('/roster/preview', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const { csv } = rosterBody.parse(req.body);
  await requirePermission(userId, orgId, 'members.manage');
  const { rows, errors } = await asUser(userId, (db) => resolveRoster(db, orgId, csv));
  res.json({
    errors,
    summary: {
      valid: rows.length,
      new: rows.filter((r) => !r.existing).length,
      alreadyRegistered: rows.filter((r) => r.existing).length,
      invalid: errors.length,
    },
    rows: rows.slice(0, 200).map(({ line, email, fullName, rollNumber, department, batch, role, existing }) =>
      ({ line, email, fullName, rollNumber, department, batch, role, existing })),
  });
});

/** All-or-nothing: if any line has a problem, nothing is imported. */
orgRouter.post('/roster/import', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const { csv } = rosterBody.parse(req.body);
  await requirePermission(userId, orgId, 'members.manage');
  const result = await asUser(userId, async (db) => {
    const { rows, errors } = await resolveRoster(db, orgId, csv);
    if (errors.length > 0) throw badRequest(`Fix ${errors.length} problem(s) in the file and upload it again.`, errors);
    const inserted = await db.query(
      `insert into campus.roster_entries (org_id, email, full_name, role, roll_number, department_id, batch_id, created_by)
       select $1, r.email, r.full_name, r.role::campus.org_role, r.roll_number, r.department_id, r.batch_id, $2
         from jsonb_to_recordset($3::jsonb) as r(email text, full_name text, role text, roll_number text, department_id uuid, batch_id uuid)
       on conflict (org_id, email) do update set
         full_name = excluded.full_name, role = excluded.role, roll_number = excluded.roll_number,
         department_id = excluded.department_id, batch_id = excluded.batch_id
         where campus.roster_entries.status = 'pending'`,
      [orgId, userId, JSON.stringify(rows.map((r) => ({
        email: r.email, full_name: r.fullName, role: r.role, roll_number: r.rollNumber,
        department_id: r.departmentId, batch_id: r.batchId,
      })))]
    );
    return { imported: inserted.rowCount, skippedAlreadyJoined: rows.filter((r) => r.existing === 'claimed').length };
  });
  res.json(result);
});

orgRouter.get('/roster', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'members.manage');
  res.json(await asUser(userId, async (db) => (await db.query(
    `select r.id, r.email, r.full_name as "fullName", r.role, r.roll_number as "rollNumber", r.status,
            d.name as department, b.name as batch, r.created_at as "createdAt", r.claimed_at as "claimedAt"
       from campus.roster_entries r
       left join campus.departments d on d.id = r.department_id
       left join campus.batches b on b.id = r.batch_id
      where r.org_id = $1 order by r.status, r.email`,
    [orgId]
  )).rows));
});
