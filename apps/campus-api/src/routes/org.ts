import { Router } from 'express';
import { z } from 'zod';
import { parseRoster, RosterRow } from '@repo/assessment-core';
import { userOf } from '../auth';
import { asSystem, asUser, Db } from '../db';
import { badRequest, notFound } from '../errors';
import { hasPermission, requireAnyPermission, requirePermission } from '../permissions';

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
// ── Units: schools, departments, branches (a tree of up to 4 levels) ─────────
orgRouter.get('/departments', async (req, res) => {
  const userId = userOf(req);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select d.id, d.name, d.code, d.kind, d.parent_id as "parentId",
            (select count(*) from campus.org_memberships m where m.department_id = d.id and m.role = 'student' and m.status = 'active')::int as students,
            (select count(*) from campus.batches b where b.department_id = d.id)::int as batches
       from campus.departments d where d.org_id = $1 order by d.name`, [orgIdOf(req)]
  )).rows));
});

const KINDS = ['school', 'department', 'branch'] as const;
const departmentBody = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(20),
  kind: z.enum(KINDS).default('department'),
  parentId: uuid.nullable().optional(),
});

orgRouter.post('/departments', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = departmentBody.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.departments (org_id, name, code, kind, parent_id) values ($1, $2, upper($3), $4, $5)
     returning id, name, code, kind, parent_id as "parentId"`,
    [orgId, body.name, body.code, body.kind, body.parentId ?? null]
  )).rows[0]));
});

const departmentPatch = departmentBody.partial();

orgRouter.patch('/departments/:departmentId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = departmentPatch.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  const row = await asUser(userId, async (db) => (await db.query(
    `update campus.departments set
        name = coalesce($3, name), code = coalesce(upper($4), code), kind = coalesce($5, kind),
        parent_id = case when $6::boolean then $7::uuid else parent_id end
      where id = $1 and org_id = $2
      returning id, name, code, kind, parent_id as "parentId"`,
    [uuid.parse(req.params.departmentId), orgId, body.name ?? null, body.code ?? null, body.kind ?? null,
     body.parentId !== undefined, body.parentId ?? null]
  )).rows[0]);
  if (!row) throw notFound('Unit not found in this college.');
  res.json(row);
});

orgRouter.delete('/departments/:departmentId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'batches.manage');
  // People, batches and child units keep existing; they just lose this unit.
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.departments where id = $1 and org_id = $2`, [uuid.parse(req.params.departmentId), orgId])).rowCount);
  if (!n) throw notFound('Unit not found in this college.');
  res.status(204).end();
});

// ── Batches ─────────────────────────────────────────────────────────────────
orgRouter.get('/batches', async (req, res) => {
  const userId = userOf(req);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select b.id, b.name, b.academic_year as "academicYear", b.graduation_year as "graduationYear", b.status,
            b.department_id as "departmentId", d.name as "departmentName",
            (select count(*) from campus.batch_members bm where bm.batch_id = b.id)::int as "studentCount",
            coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name,
                        'students', (select count(*) from campus.batch_members x where x.section_id = s.id)) order by s.name)
                        from campus.sections s where s.batch_id = b.id), '[]') as sections
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
  const rows = await asUser(userId, async (db) => (await db.query<{ user_id: string; roll_number: string | null; section_id: string | null }>(
    `select bm.user_id, m.roll_number, bm.section_id
       from campus.batch_members bm
       join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
      where bm.org_id = $1 and bm.batch_id = $2
      order by m.roll_number nulls last`,
    [orgId, uuid.parse(req.params.batchId)]
  )).rows);
  const names = await people(rows.map((r) => r.user_id));
  res.json(rows.map((r) => ({ userId: r.user_id, rollNumber: r.roll_number, sectionId: r.section_id, ...names.get(r.user_id) })));
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

const memberSectionBody = z.object({ sectionId: uuid.nullable() });

/** Put students of a batch into a section (or take them out of one). */
orgRouter.patch('/batches/:batchId/members', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = memberSectionBody.extend({ userIds: z.array(uuid).min(1).max(1000) }).parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  const updated = await asUser(userId, async (db) => (await db.query(
    `update campus.batch_members set section_id = $4 where org_id = $1 and batch_id = $2 and user_id = any($3::uuid[])`,
    [orgId, uuid.parse(req.params.batchId), body.userIds, body.sectionId]
  )).rowCount);
  res.json({ updated });
});

// ── Sections of a batch ─────────────────────────────────────────────────────
const sectionBody = z.object({ name: z.string().trim().min(1).max(60) });

orgRouter.post('/batches/:batchId/sections', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = sectionBody.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.sections (org_id, batch_id, name) values ($1, $2, $3) returning id, name`,
    [orgId, uuid.parse(req.params.batchId), body.name])).rows[0]));
});

orgRouter.patch('/batches/:batchId/sections/:sectionId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = sectionBody.parse(req.body);
  await requirePermission(userId, orgId, 'batches.manage');
  const row = await asUser(userId, async (db) => (await db.query(
    `update campus.sections set name = $4 where id = $3 and batch_id = $2 and org_id = $1 returning id, name`,
    [orgId, uuid.parse(req.params.batchId), uuid.parse(req.params.sectionId), body.name])).rows[0]);
  if (!row) throw notFound('Section not found.');
  res.json(row);
});

orgRouter.delete('/batches/:batchId/sections/:sectionId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'batches.manage');
  try {
    const n = await asUser(userId, async (db) => (await db.query(
      `delete from campus.sections where id = $3 and batch_id = $2 and org_id = $1`,
      [orgId, uuid.parse(req.params.batchId), uuid.parse(req.params.sectionId)])).rowCount);
    if (!n) throw notFound('Section not found.');
  } catch (err) {
    if ((err as { code?: string }).code === '23503') {
      throw badRequest('Tests or courses were given to this section. Archive them first, or rename the section instead.');
    }
    throw err;
  }
  res.status(204).end();
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
  const { rows, records } = await asUser(userId, async (db) => ({ records: await hasPermission(db, orgId, 'records.view'), rows: (await db.query<{
    user_id: string; role: string; status: string; roll_number: string | null; department: string | null; department_id: string | null;
    custom_role_id: string | null; custom_role_name: string | null;
    batches: string[] | null; cgpa: string | null; active_backlogs: number | null; tenth_percent: string | null; twelfth_percent: string | null;
  }>(
    `select m.user_id, m.role, m.status, m.roll_number, d.name as department, m.department_id,
            m.custom_role_id, (select cr.name from campus.custom_roles cr where cr.id = m.custom_role_id) as custom_role_name,
            m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent,
            (select array_agg(b.name order by b.name) from campus.batch_members bm
               join campus.batches b on b.id = bm.batch_id where bm.org_id = m.org_id and bm.user_id = m.user_id) as batches
       from campus.org_memberships m left join campus.departments d on d.id = m.department_id
      where m.org_id = $1 and ($2::text is null or m.role::text = $2)
      order by m.role, m.roll_number nulls last`,
    [orgId, role]
  )).rows }));
  const names = await people(rows.map((r) => r.user_id));
  const num = (v: string | number | null) => (v === null ? null : Number(v));
  res.json(rows.map((r) => ({
    userId: r.user_id, role: r.role, status: r.status, rollNumber: r.roll_number,
    department: r.department, departmentId: r.department_id, batches: r.batches ?? [], ...names.get(r.user_id),
    customRoleId: r.custom_role_id, customRoleName: r.custom_role_name,
    // Marks are for staff who keep academic records (admin, placement officer).
    ...(records && r.role === 'student' ? {
      record: { cgpa: num(r.cgpa), backlogs: r.active_backlogs, tenthPercent: num(r.tenth_percent), twelfthPercent: num(r.twelfth_percent) },
    } : {}),
  })));
});

const memberPatch = z.object({
  role: z.enum(['admin', 'placement_officer', 'faculty', 'evaluator', 'invigilator', 'student']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  rollNumber: z.string().trim().max(40).nullable().optional(),
  departmentId: uuid.nullable().optional(),
  customRoleId: uuid.nullable().optional(),
  record: z.object({
    cgpa: z.number().min(0).max(10).nullable(),
    backlogs: z.number().int().min(0).max(100).nullable(),
    tenthPercent: z.number().min(0).max(100).nullable(),
    twelfthPercent: z.number().min(0).max(100).nullable(),
  }).partial().optional(),
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
        roll_number = case when $5::boolean then $6 else roll_number end,
        department_id = case when $7::boolean then $8::uuid else department_id end,
        cgpa = case when $9::boolean then $10::numeric else cgpa end,
        active_backlogs = case when $11::boolean then $12::integer else active_backlogs end,
        tenth_percent = case when $13::boolean then $14::numeric else tenth_percent end,
        twelfth_percent = case when $15::boolean then $16::numeric else twelfth_percent end,
        custom_role_id = case when $17::boolean then $18::uuid else custom_role_id end
      where org_id = $1 and user_id = $2 returning user_id`,
    [orgId, memberId, body.role ?? null, body.status ?? null, body.rollNumber !== undefined, body.rollNumber ?? null,
     body.departmentId !== undefined, body.departmentId ?? null,
     body.record?.cgpa !== undefined, body.record?.cgpa ?? null,
     body.record?.backlogs !== undefined, body.record?.backlogs ?? null,
     body.record?.tenthPercent !== undefined, body.record?.tenthPercent ?? null,
     body.record?.twelfthPercent !== undefined, body.record?.twelfthPercent ?? null,
     body.customRoleId !== undefined, body.customRoleId ?? null]
  )).rowCount);
  if (!updated) throw notFound('Member not found, or you cannot change them.');
  res.json({ ok: true });
});

// ── Roster: preview, then import ────────────────────────────────────────────
const rosterBody = z.object({ csv: z.string().min(1).max(2_000_000) });

interface ResolvedRow extends RosterRow {
  departmentId: string | null; batchId: string | null; sectionId: string | null; existing: 'pending' | 'claimed' | null;
}

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
  const sections = (await db.query<{ id: string; batch_id: string; name: string }>(
    `select id, batch_id, name from campus.sections where org_id = $1`, [orgId])).rows;
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
    const section = row.section && batch
      ? sections.find((s) => s.batch_id === batch.id && s.name.toLowerCase() === row.section!.toLowerCase())
      : null;
    if (row.section && !section) {
      errors.push({ line: row.line, message: `Batch "${row.batch}" has no section "${row.section}". Add it on the Batches page first.` });
      continue;
    }
    resolved.push({
      ...row, departmentId: dept?.id ?? null, batchId: batch?.id ?? null, sectionId: section?.id ?? null,
      existing: existing.get(row.email) ?? null,
    });
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
    rows: rows.slice(0, 200).map(({ line, email, fullName, rollNumber, department, batch, section, role, cgpa, backlogs, existing }) =>
      ({ line, email, fullName, rollNumber, department, batch, section, role, cgpa, backlogs, existing })),
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
      `insert into campus.roster_entries (org_id, email, full_name, role, roll_number, department_id, batch_id, created_by,
                                          section_name, cgpa, active_backlogs, tenth_percent, twelfth_percent)
       select $1, r.email, r.full_name, r.role::campus.org_role, r.roll_number, r.department_id, r.batch_id, $2,
              r.section_name, r.cgpa, r.active_backlogs, r.tenth_percent, r.twelfth_percent
         from jsonb_to_recordset($3::jsonb) as r(email text, full_name text, role text, roll_number text, department_id uuid, batch_id uuid,
                                                section_name text, cgpa numeric, active_backlogs integer, tenth_percent numeric, twelfth_percent numeric)
       on conflict (org_id, email) do update set
         full_name = excluded.full_name, role = excluded.role, roll_number = excluded.roll_number,
         department_id = excluded.department_id, batch_id = excluded.batch_id, section_name = excluded.section_name,
         cgpa = excluded.cgpa, active_backlogs = excluded.active_backlogs,
         tenth_percent = excluded.tenth_percent, twelfth_percent = excluded.twelfth_percent
         where campus.roster_entries.status = 'pending'`,
      [orgId, userId, JSON.stringify(rows.map((r) => ({
        email: r.email, full_name: r.fullName, role: r.role, roll_number: r.rollNumber,
        department_id: r.departmentId, batch_id: r.batchId, section_name: r.section,
        cgpa: r.cgpa, active_backlogs: r.backlogs, tenth_percent: r.tenthPercent, twelfth_percent: r.twelfthPercent,
      })))]
    );
    // People who already joined: a re-upload refreshes their record and section
    // (only the columns present in the file; blanks leave values alone).
    const joined = rows.filter((r) => r.existing === 'claimed');
    let refreshed = 0;
    if (joined.length > 0) {
      refreshed = (await db.query(
        `update campus.org_memberships m set
            cgpa = coalesce(r.cgpa, m.cgpa), active_backlogs = coalesce(r.active_backlogs, m.active_backlogs),
            tenth_percent = coalesce(r.tenth_percent, m.tenth_percent), twelfth_percent = coalesce(r.twelfth_percent, m.twelfth_percent),
            department_id = coalesce(r.department_id, m.department_id), roll_number = coalesce(r.roll_number, m.roll_number)
           from jsonb_to_recordset($2::jsonb) as r(email text, department_id uuid, roll_number text, cgpa numeric,
                                                  active_backlogs integer, tenth_percent numeric, twelfth_percent numeric),
                campus.roster_entries e
          where e.org_id = $1 and e.email = r.email and e.status = 'claimed'
            and m.org_id = $1 and m.user_id = e.claimed_by`,
        [orgId, JSON.stringify(joined.map((r) => ({
          email: r.email, department_id: r.departmentId, roll_number: r.rollNumber, cgpa: r.cgpa, active_backlogs: r.backlogs,
          tenth_percent: r.tenthPercent, twelfth_percent: r.twelfthPercent,
        })))]
      )).rowCount ?? 0;
      await db.query(
        `update campus.batch_members bm set section_id = r.section_id
           from jsonb_to_recordset($2::jsonb) as r(email text, batch_id uuid, section_id uuid), campus.roster_entries e
          where e.org_id = $1 and e.email = r.email and e.status = 'claimed' and r.section_id is not null
            and bm.org_id = $1 and bm.batch_id = r.batch_id and bm.user_id = e.claimed_by`,
        [orgId, JSON.stringify(joined.map((r) => ({ email: r.email, batch_id: r.batchId, section_id: r.sectionId })))]
      );
    }
    return { imported: inserted.rowCount, skippedAlreadyJoined: joined.length, refreshed };
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

// ── College defaults for new assignments ────────────────────────────────────
const settingsBody = z.object({
  resultRelease: z.enum(['immediately', 'after_close', 'manual']).optional(),
  shuffle: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  lockdown: z.boolean().optional(),
  maxViolations: z.number().int().min(1).max(50).nullable().optional(),
  courseDueDays: z.number().int().min(1).max(365).optional(),
});
export type CollegeDefaults = z.infer<typeof settingsBody>;
const DEFAULTS: Required<CollegeDefaults> = {
  resultRelease: 'after_close', shuffle: true, maxAttempts: 1, lockdown: true, maxViolations: 3, courseDueDays: 14,
};

orgRouter.get('/settings', async (req, res) => {
  const userId = userOf(req);
  const row = await asUser(userId, async (db) => (await db.query<{ settings: { defaults?: CollegeDefaults } }>(
    `select settings from campus.organizations where id = $1`, [orgIdOf(req)])).rows[0]);
  if (!row) throw notFound('College not found.');
  res.json({ defaults: { ...DEFAULTS, ...(row.settings?.defaults ?? {}) } });
});

orgRouter.patch('/settings', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = settingsBody.parse(req.body);
  // The owner and college admins set exam defaults; faculty use them.
  await requireAnyPermission(userId, orgId, ['org.manage', 'members.manage']);
  // Organisation rows are writable only by the owner under RLS; admins may
  // change just the defaults, so this one key is written after the check above.
  const row = await asSystem(async (db) => (await db.query<{ settings: { defaults?: CollegeDefaults } }>(
    `update campus.organizations
        set settings = jsonb_set(settings, '{defaults}', coalesce(settings->'defaults', '{}') || $2::jsonb)
      where id = $1 returning settings`, [orgId, JSON.stringify(body)])).rows[0]);
  if (!row) throw notFound('College not found.');
  res.json({ defaults: { ...DEFAULTS, ...(row.settings.defaults ?? {}) } });
});

// ── Custom roles ────────────────────────────────────────────────────────────
const ASSIGNABLE_PERMISSIONS = ['members.manage', 'members.view', 'batches.manage', 'content.create', 'assessments.create',
  'assessments.grade', 'assessments.invigilate', 'reports.view', 'reports.export', 'records.view', 'placements.manage',
  'community.moderate'] as const;
const roleBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullable().optional(),
  permissions: z.array(z.enum(ASSIGNABLE_PERMISSIONS)).min(1).max(12),
});

orgRouter.get('/roles', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  res.json(await asUser(userId, async (db) => (await db.query(
    `select cr.id, cr.name, cr.description, cr.permissions, cr.created_at as "createdAt",
            (select count(*) from campus.org_memberships m where m.custom_role_id = cr.id)::int as members
       from campus.custom_roles cr where cr.org_id = $1 order by cr.name`, [orgId])).rows));
});

orgRouter.post('/roles', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = roleBody.parse(req.body);
  await requirePermission(userId, orgId, 'members.manage');
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.custom_roles (org_id, name, description, permissions) values ($1, $2, $3, $4) returning id, name`,
    [orgId, body.name, body.description ?? null, [...new Set(body.permissions)]])).rows[0]));
});

orgRouter.patch('/roles/:roleId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = roleBody.partial().parse(req.body);
  await requirePermission(userId, orgId, 'members.manage');
  const row = await asUser(userId, async (db) => (await db.query(
    `update campus.custom_roles set name = coalesce($3, name), description = case when $4::boolean then $5 else description end,
            permissions = coalesce($6, permissions)
      where id = $1 and org_id = $2 returning id, name, permissions`,
    [uuid.parse(req.params.roleId), orgId, body.name ?? null, body.description !== undefined, body.description ?? null,
     body.permissions ? [...new Set(body.permissions)] : null])).rows[0]);
  if (!row) throw notFound('Role not found.');
  res.json(row);
});

orgRouter.delete('/roles/:roleId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'members.manage');
  // Members with this role fall back to their base role.
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.custom_roles where id = $1 and org_id = $2`, [uuid.parse(req.params.roleId), orgId])).rowCount);
  if (!n) throw notFound('Role not found.');
  res.status(204).end();
});

// ── Bulk actions on members ─────────────────────────────────────────────────
const bulkBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('suspend'), userIds: z.array(uuid).min(1).max(1000) }),
  z.object({ action: z.literal('activate'), userIds: z.array(uuid).min(1).max(1000) }),
  z.object({ action: z.literal('role'), userIds: z.array(uuid).min(1).max(1000), role: z.enum(['admin', 'placement_officer', 'faculty', 'evaluator', 'invigilator', 'student']) }),
  z.object({ action: z.literal('customRole'), userIds: z.array(uuid).min(1).max(1000), customRoleId: uuid.nullable() }),
  z.object({ action: z.literal('addToBatch'), userIds: z.array(uuid).min(1).max(1000), batchId: uuid }),
  z.object({ action: z.literal('removeFromBatch'), userIds: z.array(uuid).min(1).max(1000), batchId: uuid }),
]);

/** One action on many people at once. Never touches the caller or the owner; RLS decides the rest. */
orgRouter.post('/members/bulk', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const body = bulkBody.parse(req.body);
  const ids = body.userIds.filter((id) => id !== userId);
  const batchAction = body.action === 'addToBatch' || body.action === 'removeFromBatch';
  await requirePermission(userId, orgId, batchAction ? 'batches.manage' : 'members.manage');
  const changed = await asUser(userId, async (db) => {
    const q = (sql: string, extra: unknown[] = []) => db.query(sql, [orgId, ids, ...extra]);
    switch (body.action) {
      case 'suspend': return (await q(`update campus.org_memberships set status = 'suspended' where org_id = $1 and user_id = any($2::uuid[]) and role <> 'owner'`)).rowCount;
      case 'activate': return (await q(`update campus.org_memberships set status = 'active' where org_id = $1 and user_id = any($2::uuid[]) and role <> 'owner'`)).rowCount;
      case 'role': return (await q(`update campus.org_memberships set role = $3::campus.org_role,
                                      custom_role_id = case when $3 = 'student' then null else custom_role_id end
                                     where org_id = $1 and user_id = any($2::uuid[]) and role <> 'owner'`, [body.role])).rowCount;
      case 'customRole': return (await q(`update campus.org_memberships set custom_role_id = $3 where org_id = $1 and user_id = any($2::uuid[])
                                           and role not in ('owner', 'student')`, [body.customRoleId])).rowCount;
      case 'addToBatch': return (await q(`insert into campus.batch_members (batch_id, org_id, user_id)
                                           select $3, $1, m.user_id from campus.org_memberships m
                                            where m.org_id = $1 and m.user_id = any($2::uuid[]) and m.role = 'student'
                                           on conflict do nothing`, [body.batchId])).rowCount;
      case 'removeFromBatch': return (await q(`delete from campus.batch_members where org_id = $1 and user_id = any($2::uuid[]) and batch_id = $3`, [body.batchId])).rowCount;
    }
  });
  res.json({ changed, skipped: body.userIds.length - (changed ?? 0) });
});

// ── Activity log ────────────────────────────────────────────────────────────
const ENTITY_LABEL: Record<string, string> = {
  tests: 'Test', testseries_questions: 'Question', test_questions: 'Question in test', test_sections: 'Test section',
  question_test_cases: 'Coding test case', assignments: 'Assignment', course_assignments: 'Course assignment', test_shares: 'Test sharing',
  org_memberships: 'Member', batches: 'Batch', batch_members: 'Batch member', sections: 'Section', departments: 'Unit',
  custom_roles: 'Role', assignment_accommodations: 'Extra time', course_licences: 'Course licence',
  placement_drives: 'Placement drive', drive_registrations: 'Drive application', drive_students: 'Drive applicants',
  results: 'Results', course_progress: 'Course progress', topic_marks: 'Topic-wise marks', students: 'Student list',
};
const activityQuery = z.object({
  entity: z.string().max(60).optional(),
  actorId: uuid.optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  format: z.enum(['csv']).optional(),
});

orgRouter.get('/activity', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const q = activityQuery.parse(req.query);
  await requireAnyPermission(userId, orgId, ['org.manage', 'members.manage']);
  const rows = await asUser(userId, async (db) => (await db.query<{
    id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; summary: string | null; changes: unknown; created_at: string;
  }>(
    `select id, actor_id, action, entity, entity_id, summary, changes, created_at from campus.audit_log
      where org_id = $1 and ($2::text is null or entity = $2) and ($3::uuid is null or actor_id = $3) and ($4::bigint is null or id < $4)
      order by id desc limit $5`,
    [orgId, q.entity ?? null, q.actorId ?? null, q.before ?? null, q.format ? 5000 : q.limit])).rows);
  // Name the people and roles that rows refer to by id (members, batch members, custom-role changes).
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const personIds = new Set<string>();
  const roleIds = new Set<string>();
  for (const r of rows) {
    if (r.actor_id) personIds.add(r.actor_id);
    if (r.summary && UUID.test(r.summary)) personIds.add(r.summary);
    const ch = r.changes as Record<string, unknown> | null;
    const cr = ch?.custom_role_id as { from?: string; to?: string } | string | undefined;
    for (const v of typeof cr === 'object' && cr ? [cr.from, cr.to] : [cr]) if (typeof v === 'string') roleIds.add(v);
  }
  const actors = await people([...personIds]);
  const roleNames = new Map(roleIds.size === 0 ? [] : await asSystem(async (db) => (await db.query<{ id: string; name: string }>(
    `select id, name from campus.custom_roles where org_id = $1 and id = any($2::uuid[])`, [orgId, [...roleIds]])).rows.map((x) => [x.id, x.name] as [string, string])));
  const NOISE = new Set(['slug', 'sort_order', 'added_at', 'is_free', 'is_sectional', 'judge_config', 'nat_tolerance', 'joined_at', 'claimed_at']);
  const tidy = (changes: unknown) => {
    if (!changes || typeof changes !== 'object') return changes;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes as Record<string, unknown>)) {
      if (NOISE.has(k)) continue;
      if (k === 'custom_role_id') {
        const name = (id: unknown) => (typeof id === 'string' ? roleNames.get(id) ?? 'a removed role' : 'none');
        const fromTo = v as { from?: unknown; to?: unknown } | null;
        out.custom_role = fromTo && typeof fromTo === 'object' && 'from' in fromTo ? { from: name(fromTo.from), to: name(fromTo.to) } : name(v);
      } else out[k] = v;
    }
    return out;
  };
  const who = (id: string) => actors.get(id)?.fullName ?? actors.get(id)?.email ?? null;
  const out = rows.map((r) => ({
    id: Number(r.id), at: r.created_at, action: r.action, entity: r.entity, what: ENTITY_LABEL[r.entity] ?? r.entity,
    entityId: r.entity_id, summary: r.summary && UUID.test(r.summary) ? who(r.summary) ?? r.summary : r.summary, changes: tidy(r.changes),
    actorId: r.actor_id, actor: r.actor_id ? who(r.actor_id) : 'System',
  }));
  if (q.format === 'csv') {
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
    };
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="activity.csv"');
    return res.send('\uFEFF' + [['When', 'Who', 'Action', 'What', 'Item', 'Changes'], ...out.map((r) => [new Date(r.at).toISOString(), r.actor, r.action, r.what, r.summary, r.changes])]
      .map((cols) => cols.map(esc).join(',')).join('\r\n'));
  }
  res.json({ rows: out, next: out.length === q.limit ? out.at(-1)!.id : null });
});
