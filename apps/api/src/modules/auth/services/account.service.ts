import jwt from 'jsonwebtoken';
import { pool, createAuthClient, supabaseAdmin } from '../../../config/database';
import logger from '../../../config/logger';
import { CacheService } from '../../core/services/cache.service';
import {
    ActivityItem, ActivityKind, METHOD_LABELS, SessionClaims, auditKind, describeUserAgent, isUuid,
    mergeAccountActivity, sessionClaims,
} from './accountHelpers';
import { markSessionsRevoked } from './sessionGuard';

/**
 * Account & security for one learner (slice W2-A1): email verification, the
 * account log, signed-in sessions (list / sign out one / sign out all others)
 * and password change. Everything is scoped to the caller's own user id; the
 * Supabase Auth tables are only reached through the service-role functions of
 * migration 20261028000001, which always filter by that id.
 */

/** Before the migration is applied (or on a project without some auth table) these read as "nothing". */
const MISSING = new Set(['42P01', '42883', '42703']);
export const isMissing = (e: any) => MISSING.has(e?.code);

export class AccountError extends Error {
    constructor(public status: number, message: string, public code = 'BAD_REQUEST') {
        super(message);
    }
}

export interface RequestContext { ip?: string | null; userAgent?: string | null; sessionId?: string | null }

const clip = (s: string | null | undefined, n: number) => (s ? String(s).slice(0, n) : null);

export const AccountEvents = {
    /** Never throws: the log must not break the action it records. */
    async record(userId: string, kind: string, ctx: RequestContext = {}, details: Record<string, unknown> = {}) {
        try {
            await pool.query(
                `insert into public.account_events (user_id, kind, session_id, ip, user_agent, details) values ($1, $2, $3, $4, $5, $6)`,
                [userId, kind, isUuid(ctx.sessionId) ? ctx.sessionId : null, clip(ctx.ip, 64), clip(ctx.userAgent, 512), JSON.stringify(details)],
            );
        } catch (error: any) {
            logger.debug('account event not recorded', { kind, code: error?.code, message: error?.message });
        }
    },

    /** The first time the API sees a session: a sign-in row with the browser's own device and IP (once per session). */
    async recordSignIn(userId: string, claims: SessionClaims, ctx: RequestContext) {
        if (!claims.sessionId) return;
        try {
            await pool.query(
                `insert into public.account_events (user_id, kind, occurred_at, session_id, ip, user_agent, details)
                 values ($1, 'sign_in', coalesce(to_timestamp($2::double precision), now()), $3, $4, $5, $6)
                 on conflict (session_id) where kind = 'sign_in' do nothing`,
                [userId, claims.signedInAt, claims.sessionId, clip(ctx.ip, 64), clip(ctx.userAgent, 512),
                 JSON.stringify({ method: claims.method, provider: claims.provider })],
            );
        } catch (error: any) {
            logger.debug('sign-in not recorded', { code: error?.code, message: error?.message });
        }
    },
};

const verifiedKey = (id: string) => `user:${id}:email-verified`;

export interface AccountInfo {
    email: string | null;
    email_verified: boolean;
    email_verified_at: string | null;
    pending_email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    providers: string[];
    has_password: boolean;
}

async function authInfo(userId: string) {
    const { rows } = await pool.query(`select * from public.account_auth_info($1)`, [userId]);
    return rows[0] ?? null;
}

const iso = (d: any) => (d ? new Date(d).toISOString() : null);

export class AccountService {
    static async getInfo(userId: string): Promise<AccountInfo> {
        const row = await authInfo(userId);
        if (!row) throw new AccountError(404, 'Account not found', 'NOT_FOUND');
        return {
            email: row.email,
            email_verified: Boolean(row.email_confirmed_at),
            email_verified_at: iso(row.email_confirmed_at),
            pending_email: row.pending_email,
            created_at: iso(row.created_at),
            last_sign_in_at: iso(row.last_sign_in_at),
            providers: row.providers ?? [],
            has_password: Boolean(row.has_password),
        };
    }

    /**
     * Whether the learner confirmed their email. Fails open (true) while the
     * migration that exposes it is missing, so payments keep working until then.
     * Only a "yes" is cached: verifying unlocks everything at once.
     */
    static async isEmailVerified(userId: string): Promise<boolean> {
        if (await CacheService.get<boolean>(verifiedKey(userId))) return true;
        try {
            const row = await authInfo(userId);
            const verified = Boolean(row?.email_confirmed_at);
            if (verified) await CacheService.set(verifiedKey(userId), true, 600);
            return verified;
        } catch (error: any) {
            if (isMissing(error)) return true;
            throw error;
        }
    }

    private static redirect() {
        return process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/verify-email` : undefined;
    }

    /** Resends Supabase's confirmation email. Supabase limits how often; we also allow one a minute per address. */
    static async resendVerification(email: string): Promise<void> {
        const key = `verify-resend:${email.toLowerCase()}`;
        if (await CacheService.exists(key)) throw new AccountError(429, 'We just sent one. Wait a minute before asking again.', 'TOO_MANY_REQUESTS');
        await CacheService.set(key, 1, 60);
        const redirect = AccountService.redirect();
        const { error } = await createAuthClient().auth.resend({ type: 'signup', email, ...(redirect ? { options: { emailRedirectTo: redirect } } : {}) });
        if (error) {
            logger.warn('Verification resend failed', { message: error.message });
            if (/rate|seconds/i.test(error.message)) throw new AccountError(429, 'Too many emails. Try again in a little while.', 'TOO_MANY_REQUESTS');
            throw new AccountError(400, 'Could not send the email. Try again later.');
        }
    }

    static async sendVerificationForUser(userId: string, ctx: RequestContext) {
        const info = await AccountService.getInfo(userId);
        if (info.email_verified) throw new AccountError(409, 'Your email is already verified.', 'CONFLICT');
        if (!info.email) throw new AccountError(400, 'There is no email address on this account.');
        await AccountService.resendVerification(info.email);
        await AccountEvents.record(userId, 'verification_email_sent', ctx);
        return { sent: true, email: info.email };
    }

    // ── Sessions ────────────────────────────────────────────────────────────

    static async listSessions(userId: string, currentSessionId: string | null) {
        let rows: any[] = [];
        try {
            rows = (await pool.query(`select * from public.account_sessions($1)`, [userId])).rows;
        } catch (error: any) {
            if (!isMissing(error)) throw error;
            return { supported: false, current_session_id: currentSessionId, sessions: [] };
        }
        const ids = rows.map((r) => r.id);
        const signIns = new Map<string, any>();
        if (ids.length) {
            try {
                const { rows: ev } = await pool.query(
                    `select session_id, ip, user_agent, details from public.account_events where user_id = $1 and kind = 'sign_in' and session_id = any($2::uuid[])`,
                    [userId, ids],
                );
                for (const e of ev) signIns.set(e.session_id, e);
            } catch (error: any) {
                if (!isMissing(error)) throw error;
            }
        }
        const sessions = rows.map((r) => {
            // Our own record holds the browser's device and IP; Supabase's row has the API server's when sign-in went through it.
            const ev = signIns.get(r.id);
            const device = describeUserAgent(ev?.user_agent ?? r.user_agent);
            const method = ev?.details?.method ?? null;
            const times = [r.created_at, r.updated_at, r.refreshed_at].filter(Boolean).map((d: any) => new Date(d).getTime());
            return {
                id: r.id,
                current: r.id === currentSessionId,
                device: device.label,
                browser: device.browser,
                os: device.os,
                mobile: device.mobile,
                ip: ev?.ip ?? r.ip ?? null,
                signed_in_at: iso(r.created_at),
                last_active_at: times.length ? new Date(Math.max(...times)).toISOString() : null,
                method: method ? METHOD_LABELS[method] ?? method : null,
            };
        });
        sessions.sort((a, b) => Number(b.current) - Number(a.current));
        return { supported: true, current_session_id: currentSessionId, sessions };
    }

    static async revokeSession(userId: string, sessionId: string, ctx: RequestContext) {
        if (!isUuid(sessionId)) throw new AccountError(404, 'Session not found', 'NOT_FOUND');
        if (sessionId === ctx.sessionId) throw new AccountError(400, "That's the device you're using now. Use Sign out instead.");
        const before = await AccountService.listSessions(userId, ctx.sessionId ?? null);
        const target = before.sessions.find((s) => s.id === sessionId);
        const { rows } = await pool.query(`select public.revoke_account_sessions($1, $2, null) as id`, [userId, sessionId]);
        if (!rows.length) throw new AccountError(404, 'Session not found', 'NOT_FOUND');
        await markSessionsRevoked(rows.map((r) => r.id));
        await AccountEvents.record(userId, 'session_revoked', ctx, { device: target?.device ?? null, ip: target?.ip ?? null });
        return { revoked: rows.length };
    }

    static async revokeOtherSessions(userId: string, ctx: RequestContext, reason: 'manual' | 'password_changed' = 'manual') {
        if (!ctx.sessionId) throw new AccountError(400, "We can't tell which session is this device's. Sign out and back in, then try again.");
        const { rows } = await pool.query(`select public.revoke_account_sessions($1, null, $2) as id`, [userId, ctx.sessionId]);
        await markSessionsRevoked(rows.map((r) => r.id));
        if (rows.length) await AccountEvents.record(userId, 'other_sessions_revoked', ctx, { count: rows.length, reason });
        return { revoked: rows.length };
    }

    // ── Password ────────────────────────────────────────────────────────────

    static async changePassword(userId: string, current: string, next: string, signOutOthers: boolean, ctx: RequestContext) {
        const info = await AccountService.getInfo(userId);
        if (!info.has_password || !info.email) {
            throw new AccountError(400, 'This account signs in with Google or GitHub and has no password to change.');
        }
        // Check the current password with a throwaway client, then drop the session that check opened.
        const { data, error } = await createAuthClient().auth.signInWithPassword({ email: info.email, password: current });
        if (error || !data.session) throw new AccountError(400, 'Your current password is not right.');
        const checkSession = sessionClaims(jwt.decode(data.session.access_token) as any).sessionId;
        if (checkSession) {
            await pool.query(`select public.revoke_account_sessions($1, $2, null)`, [userId, checkSession]).catch(() => undefined);
            await markSessionsRevoked([checkSession]);
        }
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: next });
        if (updateError) throw new AccountError(400, updateError.message || 'Could not change the password.');
        await AccountEvents.record(userId, 'password_changed', ctx);
        const others = signOutOthers && ctx.sessionId ? await AccountService.revokeOtherSessions(userId, ctx, 'password_changed') : { revoked: 0 };
        return { changed: true, signed_out_sessions: others.revoked };
    }

    // ── Account log ─────────────────────────────────────────────────────────

    static async activity(userId: string, before: string | null, limit: number) {
        const own = await pool
            .query(
                `select kind, occurred_at, ip, user_agent, details from public.account_events
                  where user_id = $1 and ($2::timestamptz is null or occurred_at < $2) order by occurred_at desc limit $3`,
                [userId, before, limit],
            )
            .then((r) => r.rows)
            .catch((e) => (isMissing(e) ? [] : Promise.reject(e)));
        // Supabase Auth's audit log covers the time before the API kept its own log.
        const firstOwn = await pool
            .query(`select min(occurred_at) as at from public.account_events where user_id = $1`, [userId])
            .then((r) => r.rows[0]?.at ?? null)
            .catch(() => null);
        const auditBefore = [before, firstOwn ? new Date(firstOwn).toISOString() : null].filter(Boolean).sort()[0] ?? null;
        const audit = await pool
            .query(`select * from public.account_audit_history($1, $2, $3)`, [userId, auditBefore, limit])
            .then((r) => r.rows)
            .catch((e) => (isMissing(e) || e?.code === '42501' ? [] : Promise.reject(e)));
        const info = await authInfo(userId).catch(() => null);
        const payments = await pool
            .query(
                `select p.updated_at, p.final_amount, p.billing_cycle, p.description, pl.name as plan_name
                   from public.payments p left join public.plans pl on pl.id = p.plan_id
                  where p.user_id = $1 and p.status = 'captured' and ($2::timestamptz is null or p.updated_at < $2)
                  order by p.updated_at desc limit $3`,
                [userId, before, limit],
            )
            .then((r) => r.rows)
            .catch((e) => (isMissing(e) ? [] : Promise.reject(e)));

        const items: ActivityItem[] = [];
        for (const e of own) {
            const d = e.details ?? {};
            const detail =
                e.kind === 'sign_in' ? (d.method ? METHOD_LABELS[d.method] ?? d.method : null)
                : e.kind === 'session_revoked' ? d.device ?? null
                : e.kind === 'other_sessions_revoked' ? `${d.count ?? 0} other session${d.count === 1 ? '' : 's'}${d.reason === 'password_changed' ? ' (after a password change)' : ''}`
                : null;
            items.push({
                kind: e.kind as ActivityKind, at: new Date(e.occurred_at).toISOString(), source: 'account_log',
                device: e.user_agent ? describeUserAgent(e.user_agent).label : null, ip: e.ip, detail,
            });
        }
        for (const a of audit) {
            const kind = auditKind(a.action);
            if (!kind) continue;
            items.push({ kind, at: new Date(a.at).toISOString(), source: 'auth_log', device: null, ip: a.ip, detail: a.provider ? METHOD_LABELS[a.provider] ?? a.provider : null });
        }
        if (info?.created_at) items.push({ kind: 'account_created', at: iso(info.created_at)!, source: 'account', device: null, ip: null, detail: null });
        if (info?.email_confirmed_at) items.push({ kind: 'email_verified', at: iso(info.email_confirmed_at)!, source: 'account', device: null, ip: null, detail: info.email });
        for (const p of payments) {
            const amount = Number(p.final_amount) > 0 ? `₹${(Number(p.final_amount) / 100).toLocaleString('en-IN')}` : 'free';
            const what = p.description || `${p.plan_name ?? 'Plan'}${p.billing_cycle ? ` (${p.billing_cycle})` : ''}`;
            items.push({ kind: 'plan_purchased', at: iso(p.updated_at)!, source: 'payments', device: null, ip: null, detail: `${what} · ${amount}` });
        }
        const page = mergeAccountActivity(items, limit, before);
        return { items: page, next_before: page.length === limit ? page[page.length - 1].at : null };
    }
}
