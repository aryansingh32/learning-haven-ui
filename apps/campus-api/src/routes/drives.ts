import { Router } from 'express';
import { z } from 'zod';
import { userOf } from '../auth';
import { asSystem, asUser } from '../db';
import { badRequest, notFound } from '../errors';
import { hasPermission, requireAnyPermission, requirePermission } from '../permissions';
import { logExport } from '../services/audit';
import { notify } from '../services/notify';
import { eligibilityBody } from './assignments';

// Placement drives (slice C3): a company visit with rounds; students who are
// eligible apply in the Forge app; placement staff shortlist and select.

export const drivesRouter = Router({ mergeParams: true });
const uuid = z.string().uuid();
const orgIdOf = (req: { params: Record<string, string> }) => uuid.parse(req.params.orgId);

const driveBody = z.object({
  company: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().min(1).max(120),
  description: z.string().trim().max(10_000).nullable().optional(),
  jobType: z.enum(['full_time', 'internship', 'internship_ppo']).default('full_time'),
  ctc: z.string().trim().max(80).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  batchIds: z.array(uuid).max(50).default([]),
  eligibility: eligibilityBody.default({}),
  applyBy: z.coerce.date().nullable().optional(),
});

const SELECT = `select d.id, d.company, d.role_title as "roleTitle", d.description, d.job_type as "jobType", d.ctc, d.location,
         d.batch_ids as "batchIds", d.eligibility, d.apply_by as "applyBy", d.status, d.created_at as "createdAt",
         (select count(*) from campus.drive_students(d.id))::int as eligible,
         (select count(*) from campus.drive_registrations r where r.drive_id = d.id and r.status <> 'withdrawn')::int as registered,
         (select count(*) from campus.drive_registrations r where r.drive_id = d.id and r.status = 'shortlisted')::int as shortlisted,
         (select count(*) from campus.drive_registrations r where r.drive_id = d.id and r.status = 'selected')::int as selected,
         coalesce((select json_agg(json_build_object('id', x.id, 'name', x.name, 'kind', x.kind, 'assignmentId', x.assignment_id,
                    'scheduledAt', x.scheduled_at) order by x.sort_order, x.scheduled_at) from campus.drive_rounds x where x.drive_id = d.id), '[]') as rounds
    from campus.placement_drives d`;

drivesRouter.get('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requireAnyPermission(userId, orgId, ['placements.manage', 'reports.view']);
  res.json(await asUser(userId, async (db) => (await db.query(`${SELECT} where d.org_id = $1 and d.status <> 'archived' order by d.created_at desc`, [orgId])).rows));
});

async function announce(orgId: string, driveId: string) {
  const d = await asSystem(async (db) => (await db.query<{ company: string; role_title: string; apply_by: string | null }>(
    `select company, role_title, apply_by from campus.placement_drives where id = $1 and org_id = $2 and status = 'open'`, [driveId, orgId])).rows[0]);
  if (!d) return;
  const users = await asSystem(async (db) => (await db.query<{ user_id: string }>(`select user_id from campus.drive_students($1)`, [driveId])).rows.map((r) => r.user_id));
  await notify(users, { orgId, kind: 'drive_announced', title: `${d.company} is hiring: ${d.role_title}`,
    body: d.apply_by ? `Apply by ${new Date(d.apply_by).toUTCString().replace(' GMT', ' UTC')}.` : 'You are eligible. Apply in My College.',
    link: '/college/drives', dedupeKey: `drive:${driveId}` });
}

drivesRouter.post('/', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const b = driveBody.extend({ open: z.boolean().default(false) }).parse(req.body);
  await requirePermission(userId, orgId, 'placements.manage');
  const row = await asUser(userId, async (db) => (await db.query<{ id: string; status: string }>(
    `insert into campus.placement_drives (org_id, company, role_title, description, job_type, ctc, location, batch_ids, eligibility, apply_by, status, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12) returning id, status`,
    [orgId, b.company, b.roleTitle, b.description ?? null, b.jobType, b.ctc ?? null, b.location ?? null, b.batchIds,
     JSON.stringify(b.eligibility), b.applyBy ?? null, b.open ? 'open' : 'draft', userId])).rows[0]);
  if (row.status === 'open') await announce(orgId, row.id);
  res.status(201).json(row);
});

drivesRouter.patch('/:driveId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const driveId = uuid.parse(req.params.driveId);
  const b = driveBody.partial().extend({ status: z.enum(['draft', 'open', 'closed', 'archived']).optional() }).parse(req.body);
  await requirePermission(userId, orgId, 'placements.manage');
  const row = await asUser(userId, async (db) => (await db.query<{ id: string; status: string }>(
    `update campus.placement_drives set
        company = coalesce($3, company), role_title = coalesce($4, role_title),
        description = case when $5::boolean then $6 else description end, job_type = coalesce($7, job_type),
        ctc = case when $8::boolean then $9 else ctc end, location = case when $10::boolean then $11 else location end,
        batch_ids = coalesce($12, batch_ids), eligibility = coalesce($13::jsonb, eligibility),
        apply_by = case when $14::boolean then $15::timestamptz else apply_by end, status = coalesce($16, status), updated_at = now()
      where id = $1 and org_id = $2 returning id, status`,
    [driveId, orgId, b.company ?? null, b.roleTitle ?? null, b.description !== undefined, b.description ?? null, b.jobType ?? null,
     b.ctc !== undefined, b.ctc ?? null, b.location !== undefined, b.location ?? null, b.batchIds ?? null,
     b.eligibility ? JSON.stringify(b.eligibility) : null, b.applyBy !== undefined, b.applyBy ?? null, b.status ?? null])).rows[0]);
  if (!row) throw notFound('Drive not found in this college.');
  if (b.status === 'open') await announce(orgId, driveId);
  res.json(row);
});

const roundBody = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['test', 'interview', 'group_discussion', 'other']).default('test'),
  assignmentId: uuid.nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});

drivesRouter.post('/:driveId/rounds', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const b = roundBody.parse(req.body);
  await requirePermission(userId, orgId, 'placements.manage');
  res.status(201).json(await asUser(userId, async (db) => (await db.query(
    `insert into campus.drive_rounds (drive_id, org_id, name, kind, assignment_id, scheduled_at, sort_order)
     values ($1, $2, $3, $4, $5, $6, coalesce((select max(sort_order) + 1 from campus.drive_rounds where drive_id = $1), 0)) returning id`,
    [uuid.parse(req.params.driveId), orgId, b.name, b.kind, b.assignmentId ?? null, b.scheduledAt ?? null])).rows[0]));
});

drivesRouter.delete('/:driveId/rounds/:roundId', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  await requirePermission(userId, orgId, 'placements.manage');
  const n = await asUser(userId, async (db) => (await db.query(
    `delete from campus.drive_rounds where id = $1 and drive_id = $2 and org_id = $3`, [uuid.parse(req.params.roundId), uuid.parse(req.params.driveId), orgId])).rowCount);
  if (!n) throw notFound('Round not found.');
  res.status(204).end();
});

/** Everyone eligible, with their registration (if any); CSV for the company. */
drivesRouter.get('/:driveId/students', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const driveId = uuid.parse(req.params.driveId);
  await requireAnyPermission(userId, orgId, ['placements.manage', 'reports.view']);
  const data = await asUser(userId, async (db) => {
    const d = (await db.query<{ company: string; role_title: string }>(`select company, role_title from campus.placement_drives where id = $1 and org_id = $2`, [driveId, orgId])).rows[0];
    if (!d) return null;
    const regs = (await db.query<{ user_id: string; status: string; registered_at: string; note: string | null }>(
      `select user_id, status, registered_at, note from campus.drive_registrations where drive_id = $1`, [driveId])).rows;
    const eligible = (await db.query<{ user_id: string }>(`select user_id from campus.drive_students($1)`, [driveId])).rows.map((r) => r.user_id);
    return { d, regs, eligible, records: await hasPermission(db, orgId, 'records.view') };
  });
  if (!data) throw notFound('Drive not found in this college.');
  const ids = [...new Set([...data.eligible, ...data.regs.map((r) => r.user_id)])];
  const people = ids.length === 0 ? [] : await asSystem(async (db) => (await db.query<{
    id: string; full_name: string | null; email: string; roll_number: string | null; department: string | null; cgpa: string | null; active_backlogs: number | null;
  }>(
    `select u.id, u.full_name, u.email, m.roll_number, d.name as department, m.cgpa, m.active_backlogs
       from public.users u join campus.org_memberships m on m.user_id = u.id and m.org_id = $2
       left join campus.departments d on d.id = m.department_id where u.id = any($1::uuid[])`, [ids, orgId])).rows);
  const rows = people.map((p) => {
    const r = data.regs.find((x) => x.user_id === p.id);
    return {
      userId: p.id, name: p.full_name, email: p.email, rollNumber: p.roll_number, department: p.department,
      ...(data.records ? { cgpa: p.cgpa === null ? null : Number(p.cgpa), backlogs: p.active_backlogs } : {}),
      eligible: data.eligible.includes(p.id), status: r?.status ?? null, registeredAt: r?.registered_at ?? null, note: r?.note ?? null,
    };
  }).sort((a, b) => (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, { numeric: true }));
  if (req.query.format === 'csv') {
    await requirePermission(userId, orgId, 'reports.export');
    await logExport(orgId, userId, 'drive_students', `${data.d.company} — ${data.d.role_title}`);
    const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
    const header = ['Roll number', 'Name', 'Email', 'Department', ...(data.records ? ['CGPA', 'Backlogs'] : []), 'Status', 'Registered at'];
    const lines = [header, ...rows.filter((r) => r.status && r.status !== 'withdrawn').map((r) => [r.rollNumber, r.name, r.email, r.department,
      ...(data.records ? [r.cgpa, r.backlogs] : []), r.status, r.registeredAt ? new Date(r.registeredAt).toISOString() : ''])];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${`${data.d.company}-applicants`.replace(/[^a-z0-9-]+/gi, '_')}.csv"`);
    return res.send('﻿' + lines.map((c) => c.map(esc).join(',')).join('\r\n'));
  }
  res.json({ drive: { company: data.d.company, roleTitle: data.d.role_title }, rows });
});

const decisionBody = z.object({
  userIds: z.array(uuid).min(1).max(1000),
  status: z.enum(['registered', 'shortlisted', 'selected', 'rejected']),
  note: z.string().trim().max(500).nullable().optional(),
});

/** Move applicants on; each one hears about it in the app. */
drivesRouter.post('/:driveId/decisions', async (req, res) => {
  const userId = userOf(req);
  const orgId = orgIdOf(req);
  const driveId = uuid.parse(req.params.driveId);
  const b = decisionBody.parse(req.body);
  await requirePermission(userId, orgId, 'placements.manage');
  const { changed, drive } = await asUser(userId, async (db) => {
    const drive = (await db.query<{ company: string; role_title: string }>(`select company, role_title from campus.placement_drives where id = $1 and org_id = $2`, [driveId, orgId])).rows[0];
    if (!drive) throw notFound('Drive not found in this college.');
    const changed = (await db.query<{ user_id: string }>(
      `update campus.drive_registrations set status = $3, note = coalesce($4, note), updated_at = now()
        where drive_id = $1 and user_id = any($2::uuid[]) and status <> 'withdrawn' returning user_id`,
      [driveId, b.userIds, b.status, b.note ?? null])).rows.map((r) => r.user_id);
    return { changed, drive };
  });
  if (changed.length === 0) throw badRequest('None of those students have applied.');
  if (b.status !== 'registered') {
    const words = { shortlisted: 'You are shortlisted', selected: 'Congratulations — you are selected', rejected: 'An update on your application' };
    await notify(changed, { orgId, kind: 'drive_update', title: `${words[b.status]}: ${drive.company}`,
      body: b.status === 'rejected' ? `${drive.role_title}: you were not taken forward this time.` : drive.role_title,
      link: '/college/drives', dedupeKey: `drive:${driveId}:${b.status}` });
  }
  res.json({ changed: changed.length });
});

// ── Students ────────────────────────────────────────────────────────────────
export async function myDrives(userId: string) {
  return asUser(userId, async (db) => (await db.query(
    `select d.id, d.company, d.role_title as "roleTitle", d.description, d.job_type as "jobType", d.ctc, d.location,
            d.apply_by as "applyBy", d.status, o.name as "orgName",
            campus.can_register_drive(d.id) as "canApply",
            (select r.status from campus.drive_registrations r where r.drive_id = d.id and r.user_id = $1) as "myStatus",
            coalesce((select json_agg(json_build_object('name', x.name, 'kind', x.kind, 'scheduledAt', x.scheduled_at, 'assignmentId', x.assignment_id)
                       order by x.sort_order, x.scheduled_at) from campus.drive_rounds x where x.drive_id = d.id), '[]') as rounds
       from campus.placement_drives d join campus.organizations o on o.id = d.org_id
      where d.status in ('open', 'closed')
      order by (d.status = 'open') desc, d.apply_by nulls last, d.created_at desc`, [userId])).rows);
}

export async function setMyRegistration(userId: string, driveId: string, register: boolean) {
  return asUser(userId, async (db) => {
    const d = (await db.query<{ org_id: string }>(`select org_id from campus.placement_drives where id = $1`, [driveId])).rows[0];
    if (!d) throw notFound('Drive not found.');
    if (register) {
      const ok = (await db.query<{ ok: boolean }>(`select campus.can_register_drive($1) as ok`, [driveId])).rows[0].ok;
      if (!ok) throw badRequest('Applications for this drive are closed, or you are not eligible.');
      await db.query(
        `insert into campus.drive_registrations (drive_id, org_id, user_id) values ($1, $2, $3)
         on conflict (drive_id, user_id) do update set status = 'registered', updated_at = now() where campus.drive_registrations.status = 'withdrawn'`,
        [driveId, d.org_id, userId]);
    } else {
      const n = (await db.query(`update campus.drive_registrations set status = 'withdrawn', updated_at = now()
                                  where drive_id = $1 and user_id = $2 and status = 'registered'`, [driveId, userId])).rowCount;
      if (!n) throw badRequest('You can withdraw only while your application is waiting.');
    }
    return (await db.query<{ status: string }>(`select status from campus.drive_registrations where drive_id = $1 and user_id = $2`, [driveId, userId])).rows[0];
  });
}
