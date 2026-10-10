import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../config/database';
import { requireSuperAdmin } from '../../../middleware/requireAdmin';
import { ControlCentre, announcementRow } from '../../core/services/controlCentre.service';

/**
 * Admin control centre (mounted at /admin/control, behind requireAdmin):
 * maintenance mode and sign-ups (super admins), feature flags and module kill
 * switches, announcements. Every change clears the cached control state.
 */
const router = Router();

const KEY = /^[a-z][a-z0-9_.]{1,63}$/;
const adminId = (req: any): string => req.user.id;
const parse = <T>(schema: z.ZodType<T>, body: unknown, res: any): T | null => {
    const r = schema.safeParse(body);
    if (!r.success) {
        res.status(400).json({ error: r.error.issues[0]?.message ?? 'Invalid request' });
        return null;
    }
    return r.data;
};

router.get('/', async (_req, res) => {
    ControlCentre.invalidate();
    const state = await ControlCentre.state();
    const { rows } = await pool.query(`select * from public.announcements order by created_at desc limit 100`);
    res.json({
        maintenance: state.maintenance,
        maintenanceMessage: state.maintenanceMessage,
        signupsOpen: state.signupsOpen,
        flags: state.flags,
        announcements: rows.map(announcementRow),
    });
});

// ── Maintenance and sign-ups ─────────────────────────────────────────────────
const systemSchema = z.object({
    maintenance: z.boolean().optional(),
    maintenanceMessage: z.string().trim().min(2).max(300).optional(),
    signupsOpen: z.boolean().optional(),
}).strict();

router.put('/system', requireSuperAdmin, async (req, res) => {
    const body = parse(systemSchema, req.body, res);
    if (!body) return;
    const writes: [string, unknown, string][] = [];
    if (body.maintenance !== undefined) writes.push(['maintenance_mode', body.maintenance, 'Enable maintenance mode']);
    if (body.maintenanceMessage !== undefined) writes.push(['maintenance_message', body.maintenanceMessage, 'Shown to learners while maintenance mode is on']);
    if (body.signupsOpen !== undefined) writes.push(['signup_enabled', body.signupsOpen, 'Allow new user registrations']);
    for (const [key, value, description] of writes) {
        await pool.query(
            `insert into public.system_settings (key, value, description, category, updated_by, updated_at)
             values ($1, $2::jsonb, $3, 'general', $4, now())
             on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
            [key, JSON.stringify(value), description, adminId(req)]);
    }
    ControlCentre.invalidate();
    res.json(await ControlCentre.state());
});

// ── Feature flags and kill switches ──────────────────────────────────────────
const orgIds = z.array(z.string().uuid()).max(500);
const createFlagSchema = z.object({
    key: z.string().regex(KEY, 'Use lower-case letters, digits, dots and underscores (e.g. practice.new_editor)'),
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().default(false),
    rollout: z.number().int().min(0).max(100).default(0),
    orgIds: orgIds.default([]),
}).strict();
const updateFlagSchema = z.object({
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    rollout: z.number().int().min(0).max(100).optional(),
    orgIds: orgIds.optional(),
}).strict();

router.post('/flags', async (req, res) => {
    const body = parse(createFlagSchema, req.body, res);
    if (!body) return;
    if (body.key.startsWith('module.')) return res.status(400).json({ error: '"module." is kept for kill switches' });
    try {
        await pool.query(
            `insert into public.feature_flags (key, kind, enabled, rollout_percentage, org_ids, description, updated_by)
             values ($1, 'release', $2, $3, $4::uuid[], $5, $6)`,
            [body.key, body.enabled, body.rollout, body.orgIds, body.description ?? null, adminId(req)]);
    } catch (error: any) {
        if (error?.code === '23505') return res.status(409).json({ error: 'A flag with this key already exists' });
        throw error;
    }
    ControlCentre.invalidate();
    res.status(201).json((await ControlCentre.state()).flags.find((f) => f.key === body.key));
});

router.put('/flags/:key', async (req, res) => {
    const body = parse(updateFlagSchema, req.body, res);
    if (!body) return;
    const { rows: [flag] } = await pool.query(`select kind from public.feature_flags where key = $1`, [req.params.key]);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });
    if (flag.kind === 'kill_switch' && (body.rollout !== undefined || body.orgIds !== undefined)) {
        return res.status(400).json({ error: 'A kill switch is only on or off' });
    }
    await pool.query(
        `update public.feature_flags set
           enabled = coalesce($2, enabled),
           rollout_percentage = coalesce($3, rollout_percentage),
           org_ids = coalesce($4::uuid[], org_ids),
           description = case when $5 then $6 else description end,
           updated_by = $7, updated_at = now()
         where key = $1`,
        [req.params.key, body.enabled ?? null, body.rollout ?? null, body.orgIds ?? null,
         body.description !== undefined, body.description ?? null, adminId(req)]);
    ControlCentre.invalidate();
    res.json((await ControlCentre.state()).flags.find((f) => f.key === req.params.key));
});

router.delete('/flags/:key', async (req, res) => {
    const { rows: [flag] } = await pool.query(`select kind from public.feature_flags where key = $1`, [req.params.key]);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });
    if (flag.kind === 'kill_switch') return res.status(400).json({ error: 'Kill switches can be turned off, not deleted' });
    await pool.query(`delete from public.feature_flags where key = $1`, [req.params.key]);
    ControlCentre.invalidate();
    res.json({ deleted: true });
});

// ── Announcements ────────────────────────────────────────────────────────────
const announcementSchema = z.object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().max(1000).default(''),
    level: z.enum(['info', 'warning', 'critical']).default('info'),
    audience: z.enum(['everyone', 'signed_in', 'colleges']).default('everyone'),
    linkUrl: z.string().url().startsWith('https://', 'Links must start with https://').max(1000).nullable().optional(),
    linkLabel: z.string().trim().max(40).nullable().optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    isActive: z.boolean().default(true),
}).strict().refine((a) => !a.endsAt || new Date(a.endsAt) > new Date(a.startsAt ?? Date.now()), { message: 'The end must be after the start' });

const saveAnnouncement = async (id: string | null, a: z.infer<typeof announcementSchema>, by: string) => {
    const params = [a.title, a.body, a.level, a.audience, a.linkUrl ?? null, a.linkLabel || null,
        a.startsAt ?? new Date().toISOString(), a.endsAt ?? null, a.isActive];
    const { rows: [row] } = id
        ? await pool.query(
            `update public.announcements set title = $1, body = $2, level = $3, audience = $4, link_url = $5, link_label = $6,
               starts_at = $7, ends_at = $8, is_active = $9, updated_at = now() where id = $10 returning *`, [...params, id])
        : await pool.query(
            `insert into public.announcements (title, body, level, audience, link_url, link_label, starts_at, ends_at, is_active, created_by)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`, [...params, by]);
    ControlCentre.invalidate();
    return row ? announcementRow(row) : null;
};

router.post('/announcements', async (req, res) => {
    const body = parse(announcementSchema, req.body, res);
    if (!body) return;
    res.status(201).json(await saveAnnouncement(null, body, adminId(req)));
});

router.put('/announcements/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'Announcement not found' });
    const body = parse(announcementSchema, req.body, res);
    if (!body) return;
    const saved = await saveAnnouncement(req.params.id, body, adminId(req));
    if (!saved) return res.status(404).json({ error: 'Announcement not found' });
    res.json(saved);
});

router.delete('/announcements/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'Announcement not found' });
    const { rowCount } = await pool.query(`delete from public.announcements where id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Announcement not found' });
    ControlCentre.invalidate();
    res.json({ deleted: true });
});

export default router;
