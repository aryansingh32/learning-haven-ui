import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import { forgetBans } from '../../auth/services/banGuard';

/**
 * Forge admin → Users: the list (with filters), suspending and restoring accounts,
 * roles, many at once, and CSV export. Staff accounts (admin, super_admin) are never
 * suspended from here — demote first — and nobody changes their own account.
 */

export type UserStatusFilter = 'all' | 'active' | 'banned' | 'staff';
export type BulkAction = 'ban' | 'unban' | 'set_role';
export type Role = 'user' | 'admin' | 'super_admin';
export interface BulkResult { updated: string[]; skipped: { id: string; reason: string }[] }

const STAFF = ['admin', 'super_admin'];

/** Filters shared by the list and the export. */
function where(filters: { search?: string; plan?: string; status?: UserStatusFilter }) {
    const clauses = ['u.deleted_at is null'];
    const params: unknown[] = [];
    if (filters.search?.trim()) {
        params.push(`%${filters.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
        clauses.push(`(u.email ilike $${params.length} or u.full_name ilike $${params.length})`);
    }
    if (filters.plan && filters.plan !== 'all') {
        params.push(filters.plan);
        clauses.push(`coalesce(u.current_plan, 'free') = $${params.length}`);
    }
    if (filters.status === 'banned') clauses.push('coalesce(u.is_banned, false)');
    if (filters.status === 'active') clauses.push('not coalesce(u.is_banned, false)');
    if (filters.status === 'staff') clauses.push(`u.role in ('admin', 'super_admin')`);
    return { sql: clauses.join(' and '), params };
}

export const AdminUsersService = {
    async list(page: number, limit: number, filters: { search?: string; plan?: string; status?: UserStatusFilter }) {
        const { sql, params } = where(filters);
        const size = Math.min(Math.max(limit, 1), 100);
        const offset = (Math.max(page, 1) - 1) * size;
        const [rows, count] = await Promise.all([
            pool.query(
                `select u.id, u.email, u.full_name, coalesce(u.current_plan, 'free') as current_plan, u.role, u.xp, u.streak,
                        u.created_at, u.last_active_date, coalesce(u.is_banned, false) as is_banned, u.banned_at
                   from public.users u where ${sql}
                  order by u.created_at desc limit ${size} offset ${offset}`, params),
            pool.query(`select count(*)::int as n from public.users u where ${sql}`, params),
        ]);
        const total = count.rows[0].n as number;
        return { users: rows.rows, total, page, limit: size, total_pages: Math.ceil(total / size) };
    },

    /**
     * Suspend, restore or change the role of many accounts at once. Accounts it
     * won't touch are reported, not failed. Role changes are for super admins only
     * (checked by the route).
     */
    async bulk(adminId: string, userIds: string[], action: BulkAction, role?: Role): Promise<BulkResult> {
        const ids = [...new Set(userIds)];
        const { rows } = await pool.query<{ id: string; role: string; is_banned: boolean }>(
            `select id, role, coalesce(is_banned, false) as is_banned from public.users where id = any($1::uuid[]) and deleted_at is null`, [ids]);
        const found = new Map<string, { id: string; role: string; is_banned: boolean }>(rows.map((r) => [r.id, r]));
        const skipped: BulkResult['skipped'] = [];
        const targets: string[] = [];
        for (const id of ids) {
            const u = found.get(id);
            if (!u) skipped.push({ id, reason: 'not found' });
            else if (id === adminId) skipped.push({ id, reason: 'your own account' });
            else if (action === 'ban' && STAFF.includes(u.role)) skipped.push({ id, reason: 'staff account (change the role first)' });
            else if (action === 'ban' && u.is_banned) skipped.push({ id, reason: 'already suspended' });
            else if (action === 'unban' && !u.is_banned) skipped.push({ id, reason: 'not suspended' });
            else if (action === 'set_role' && u.role === role) skipped.push({ id, reason: `already ${role}` });
            else targets.push(id);
        }
        if (targets.length) {
            const client = await pool.connect();
            try {
                await client.query('begin');
                if (action === 'set_role') {
                    await client.query(`update public.users set role = $2 where id = any($1::uuid[])`, [targets, role]);
                } else {
                    const banned = action === 'ban';
                    await client.query(
                        `update public.users set is_banned = $2, banned_at = case when $2 then now() else null end where id = any($1::uuid[])`,
                        [targets, banned]);
                }
                await client.query(
                    `insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, new_value)
                     select $1, $2, 'user', t, $3::jsonb from unnest($4::text[]) as t`,
                    [adminId, action === 'set_role' ? 'update_role' : action === 'ban' ? 'ban_user' : 'unban_user',
                     JSON.stringify(action === 'set_role' ? { role } : { banned: action === 'ban' }), targets]);
                await client.query('commit');
            } catch (error) {
                await client.query('rollback').catch(() => {});
                throw error;
            } finally {
                client.release();
            }
            forgetBans(targets);
            await Promise.all(targets.map((id) => CacheService.delPattern(`user:${id}:*`).catch(() => {})));
        }
        return { updated: targets, skipped };
    },

    /** The filtered list as CSV (at most `max` rows), for spreadsheets. */
    async exportCsv(adminId: string, filters: { search?: string; plan?: string; status?: UserStatusFilter }, max = 10_000) {
        const { sql, params } = where(filters);
        const { rows } = await pool.query(
            `select u.id, u.email, u.full_name, coalesce(u.current_plan, 'free') as plan, u.role, u.xp, u.streak,
                    coalesce(u.is_banned, false) as suspended, u.created_at, u.last_active_date
               from public.users u where ${sql} order by u.created_at desc limit ${max}`, params);
        await pool.query(
            `insert into public.admin_audit_logs (admin_id, action, entity_type, new_value) values ($1, 'export_users', 'user', $2::jsonb)`,
            [adminId, JSON.stringify({ filters, rows: rows.length })]).catch(() => {});
        const cols = ['id', 'email', 'full_name', 'plan', 'role', 'xp', 'streak', 'suspended', 'created_at', 'last_active_date'];
        return [cols.join(','), ...rows.map((r: any) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
    },
};

/** One CSV cell; text that a spreadsheet would run as a formula is neutralised. */
export function csvCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
