/**
 * Pure helpers for the account & profile slice (W2-A1): reading session claims,
 * naming devices, shaping the account log, and validating skills / portfolio input.
 */

// ── Session claims ──────────────────────────────────────────────────────────

export interface SessionClaims {
    sessionId: string | null;
    /** How the session was opened (password, oauth, otp, magiclink …), from the JWT `amr` claim. */
    method: string | null;
    provider: string | null;
    /** When the session was opened (seconds since epoch), from `amr` when present. */
    signedInAt: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Supabase access tokens carry `session_id`, `amr` and `app_metadata.provider`. */
export function sessionClaims(payload: Record<string, any> | null | undefined): SessionClaims {
    const amr = Array.isArray(payload?.amr) ? payload!.amr : [];
    const first = amr.find((a: any) => a && typeof a.method === 'string') ?? null;
    return {
        sessionId: isUuid(payload?.session_id) ? payload!.session_id.toLowerCase() : null,
        method: first?.method ?? null,
        provider: typeof payload?.app_metadata?.provider === 'string' ? payload!.app_metadata.provider : null,
        signedInAt: typeof first?.timestamp === 'number' ? first.timestamp : null,
    };
}

// ── Devices ─────────────────────────────────────────────────────────────────

export interface Device { browser: string | null; os: string | null; mobile: boolean; label: string }

/** "Chrome on Windows" style names from a user agent; never throws. */
export function describeUserAgent(ua: string | null | undefined): Device {
    const s = (ua ?? '').slice(0, 512);
    if (!s.trim()) return { browser: null, os: null, mobile: false, label: 'Unknown device' };
    const os =
        /Android/i.test(s) ? 'Android'
        : /iPhone|iPad|iPod/i.test(s) ? 'iOS'
        : /Windows/i.test(s) ? 'Windows'
        : /CrOS/i.test(s) ? 'ChromeOS'
        : /Mac OS X|Macintosh/i.test(s) ? 'macOS'
        : /Linux/i.test(s) ? 'Linux'
        : null;
    const browser =
        /Edg(e|A|iOS)?\//.test(s) ? 'Edge'
        : /OPR\/|Opera/.test(s) ? 'Opera'
        : /SamsungBrowser\//.test(s) ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(s) ? 'Firefox'
        : /Chrome\/|CriOS\//.test(s) ? 'Chrome'
        : /Safari\//.test(s) && /Version\//.test(s) ? 'Safari'
        : /^node|undici|supabase|axios|curl|okhttp|python-requests/i.test(s) ? 'App or script'
        : null;
    const mobile = /Mobile|Android|iPhone|iPod/i.test(s);
    const label = browser && os ? `${browser} on ${os}` : browser ?? os ?? 'Unknown device';
    return { browser, os, mobile, label };
}

// ── Account log ─────────────────────────────────────────────────────────────

export type ActivityKind =
    | 'account_created' | 'email_verified' | 'sign_in' | 'sign_out' | 'session_revoked' | 'other_sessions_revoked'
    | 'password_changed' | 'password_reset_requested' | 'verification_email_sent' | 'account_updated'
    | 'plan_purchased' | 'portfolio_published' | 'portfolio_unpublished';

export interface ActivityItem {
    kind: ActivityKind;
    at: string;
    /** Where the row comes from: our account log, Supabase Auth's audit log, the account record, or payments. */
    source: 'account_log' | 'auth_log' | 'account' | 'payments';
    device: string | null;
    ip: string | null;
    detail: string | null;
}

const AUDIT_KINDS: Record<string, ActivityKind> = {
    login: 'sign_in',
    logout: 'sign_out',
    user_updated_password: 'password_changed',
    user_recovery_requested: 'password_reset_requested',
    user_confirmation_requested: 'verification_email_sent',
    user_modified: 'account_updated',
};

/** Supabase Auth audit actions we show; account creation comes from the account record instead. */
export const auditKind = (action: string | null | undefined): ActivityKind | null => (action ? AUDIT_KINDS[action] ?? null : null);

export const METHOD_LABELS: Record<string, string> = {
    password: 'Email and password', oauth: 'Google or GitHub', otp: 'One-time code', magiclink: 'Email link',
    email: 'Email and password', google: 'Google', github: 'GitHub', phone: 'Phone',
};

/** Newest first, at most `limit`, optionally only before a moment. */
export function mergeAccountActivity(items: ActivityItem[], limit = 30, before?: string | null): ActivityItem[] {
    return items
        .filter((i) => !before || i.at < before)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, limit);
}

// ── Passwords ───────────────────────────────────────────────────────────────

export function checkNewPassword(current: unknown, next: unknown): string | null {
    if (typeof next !== 'string' || next.length < 8) return 'Use at least 8 characters for the new password.';
    if (next.length > 72) return 'Use at most 72 characters.';
    if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) return 'Use at least one letter and one number.';
    if (typeof current === 'string' && current === next) return 'The new password must be different from the current one.';
    return null;
}

// ── Skills ──────────────────────────────────────────────────────────────────

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export const SKILL_CATEGORIES = ['language', 'framework', 'tool', 'concept', 'soft'] as const;
export type SkillLevel = typeof SKILL_LEVELS[number];
export interface SkillInput { name: string; level: SkillLevel; category: typeof SKILL_CATEGORIES[number] | null }
export const MAX_SKILLS = 30;

type Clean<T> = { ok: true; value: T } | { ok: false; error: string };

/** The whole list a learner saves: trimmed, de-duplicated (any case), at most 30. */
export function cleanSkills(input: unknown): Clean<SkillInput[]> {
    if (!Array.isArray(input)) return { ok: false, error: 'skills must be a list' };
    if (input.length > MAX_SKILLS) return { ok: false, error: `At most ${MAX_SKILLS} skills.` };
    const seen = new Set<string>();
    const out: SkillInput[] = [];
    for (const raw of input) {
        const name = typeof raw?.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
        if (!name || name.length > 40) return { ok: false, error: 'Each skill needs a name of up to 40 characters.' };
        if (/[<>{}]/.test(name)) return { ok: false, error: `"${name}" has characters that aren't allowed.` };
        if (!SKILL_LEVELS.includes(raw?.level)) return { ok: false, error: `Pick a level for ${name}.` };
        const category = raw?.category == null || raw.category === '' ? null : raw.category;
        if (category !== null && !SKILL_CATEGORIES.includes(category)) return { ok: false, error: `Unknown category for ${name}.` };
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name, level: raw.level, category });
    }
    return { ok: true, value: out };
}

/** Skill names from the resume builder's comma-separated fields, minus ones already declared. */
export function resumeSkillSuggestions(resumeData: any, declared: string[]): Array<{ name: string; category: SkillInput['category'] }> {
    const skills = resumeData?.skills ?? {};
    const fields: Array<[string, SkillInput['category']]> = [['languages', 'language'], ['frameworks', 'framework'], ['tools', 'tool'], ['softSkills', 'soft']];
    const have = new Set(declared.map((d) => d.toLowerCase()));
    const out: Array<{ name: string; category: SkillInput['category'] }> = [];
    for (const [field, category] of fields) {
        const value = skills[field];
        if (typeof value !== 'string') continue;
        for (const part of value.split(/[,;\n]/)) {
            const name = part.replace(/\s+/g, ' ').trim();
            if (!name || name.length > 40 || /[<>{}]/.test(name) || have.has(name.toLowerCase())) continue;
            have.add(name.toLowerCase());
            out.push({ name, category });
        }
    }
    return out.slice(0, MAX_SKILLS);
}

// ── Portfolio ───────────────────────────────────────────────────────────────

const RESERVED = new Set(['admin', 'api', 'forge', 'support', 'help', 'root', 'system', 'settings', 'staff', 'campus', 'official', 'null', 'undefined', 'www', 'team']);

export function cleanHandle(raw: unknown): Clean<string> {
    const h = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(h) || h.includes('--')) {
        return { ok: false, error: 'Use 3–30 lower-case letters, digits or single hyphens (not at the start or end).' };
    }
    if (RESERVED.has(h)) return { ok: false, error: 'That address is reserved. Pick another.' };
    return { ok: true, value: h };
}

/** A starting handle from a name: "Priya Sharma" → "priya-sharma". */
export function suggestHandle(name: string | null | undefined): string {
    const base = (name ?? '').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26).replace(/-+$/g, '');
    return base.length >= 3 && !RESERVED.has(base) ? base : `learner-${Math.random().toString(36).slice(2, 7)}`;
}

export interface PortfolioInput {
    handle: string; is_public: boolean; headline: string | null; bio: string | null;
    show_college: boolean; show_skills: boolean; show_evidence: boolean; show_repo_links: boolean;
    certificate_refs: string[]; project_ids: string[];
}

const REF = /^(topic|apprenticeship|program):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const text = (v: unknown, max: number): Clean<string | null> => {
    if (v == null) return { ok: true, value: null };
    if (typeof v !== 'string') return { ok: false, error: 'Expected text.' };
    const t = v.replace(/\r\n/g, '\n').trim();
    if (t.length > max) return { ok: false, error: `Keep it to ${max} characters.` };
    return { ok: true, value: t || null };
};

export function cleanPortfolio(body: any): Clean<PortfolioInput> {
    const handle = cleanHandle(body?.handle);
    if ('error' in handle) return { ok: false, error: handle.error };
    const headline = text(body?.headline, 120);
    if ('error' in headline) return { ok: false, error: `Headline: ${headline.error}` };
    const bio = text(body?.bio, 600);
    if ('error' in bio) return { ok: false, error: `About: ${bio.error}` };
    const refs = Array.isArray(body?.certificate_refs) ? body.certificate_refs : [];
    const projects = Array.isArray(body?.project_ids) ? body.project_ids : [];
    if (refs.length > 30 || !refs.every((r: unknown) => typeof r === 'string' && REF.test(r))) return { ok: false, error: 'Unknown certificate.' };
    if (projects.length > 20 || !projects.every(isUuid)) return { ok: false, error: 'Unknown project.' };
    const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    return {
        ok: true,
        value: {
            handle: handle.value,
            is_public: bool(body?.is_public, false),
            headline: headline.value,
            bio: bio.value,
            show_college: bool(body?.show_college, false),
            show_skills: bool(body?.show_skills, true),
            show_evidence: bool(body?.show_evidence, true),
            show_repo_links: bool(body?.show_repo_links, false),
            certificate_refs: [...new Set<string>(refs)],
            project_ids: [...new Set<string>(projects.map((p: string) => p.toLowerCase()))],
        },
    };
}
