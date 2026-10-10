import crypto from 'crypto';
import { pool } from '../../../config/database';
import logger from '../../../config/logger';
import { ProblemsService } from '../../learning/services/problems.service';

/**
 * The admin control centre's live state: maintenance mode, whether sign-ups are
 * open, feature flags (release flags and module kill switches) and announcements.
 *
 * Read on almost every request, so it is held in this process for a few seconds;
 * a change made through the admin clears it here at once and reaches other
 * instances within CACHE_MS.
 */

export type FlagKind = 'release' | 'kill_switch';
export interface Flag {
    key: string;
    kind: FlagKind;
    enabled: boolean;
    rollout: number;
    orgIds: string[];
    description: string | null;
    updatedAt: string;
}
export type AnnouncementLevel = 'info' | 'warning' | 'critical';
export type AnnouncementAudience = 'everyone' | 'signed_in' | 'colleges';
export interface Announcement {
    id: string;
    title: string;
    body: string;
    level: AnnouncementLevel;
    audience: AnnouncementAudience;
    linkUrl: string | null;
    linkLabel: string | null;
    startsAt: string;
    endsAt: string | null;
    isActive: boolean;
}
export interface ControlState {
    maintenance: boolean;
    maintenanceMessage: string;
    signupsOpen: boolean;
    flags: Flag[];
    announcements: Announcement[]; // live and upcoming (active, not ended)
}

export const DEFAULT_MAINTENANCE_MESSAGE = "We're making Forge better. Back shortly.";
const CACHE_MS = 10_000;

/**
 * Settings were saved over the years both as JSON values and as JSON strings of
 * JSON (`"\"true\""`); this reads either.
 */
export function settingValue(raw: unknown): unknown {
    let v = raw;
    for (let i = 0; i < 3 && typeof v === 'string'; i++) {
        try { v = JSON.parse(v); } catch { break; }
    }
    return v;
}
const truthy = (raw: unknown, fallback: boolean) => {
    const v = settingValue(raw);
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return fallback;
};

/** Stable 0–99 bucket for a learner and a flag, so a rollout doesn't flicker between requests. */
export function rolloutBucket(flagKey: string, userId: string): number {
    return crypto.createHash('sha1').update(`${flagKey}:${userId}`).digest().readUInt32BE(0) % 100;
}

/** Whether a flag is on for this learner (or a visitor when userId is absent). */
export function evaluateFlag(flag: Flag, userId: string | null | undefined, orgIds: string[]): boolean {
    if (!flag.enabled) return false;
    if (flag.kind === 'kill_switch') return true;
    if (flag.rollout >= 100) return true;
    if (orgIds.some((id) => flag.orgIds.includes(id))) return true;
    if (!userId) return false;
    return rolloutBucket(flag.key, userId) < flag.rollout;
}

/** Whether an announcement is showing now for this kind of viewer. */
export function announcementApplies(a: Announcement, viewer: { signedIn: boolean; inCollege: boolean }, now = new Date()): boolean {
    if (!a.isActive || new Date(a.startsAt) > now || (a.endsAt && new Date(a.endsAt) <= now)) return false;
    if (a.audience === 'signed_in') return viewer.signedIn;
    if (a.audience === 'colleges') return viewer.inCollege;
    return true;
}

const flagRow = (r: any): Flag => ({
    key: r.key, kind: r.kind, enabled: r.enabled, rollout: r.rollout_percentage, orgIds: r.org_ids ?? [],
    description: r.description, updatedAt: new Date(r.updated_at).toISOString(),
});
export const announcementRow = (r: any): Announcement => ({
    id: r.id, title: r.title, body: r.body, level: r.level, audience: r.audience, linkUrl: r.link_url, linkLabel: r.link_label,
    startsAt: new Date(r.starts_at).toISOString(), endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null, isActive: r.is_active,
});

let cached: { at: number; state: ControlState } | null = null;
let loading: Promise<ControlState> | null = null;

async function load(): Promise<ControlState> {
    const [settings, flags, announcements] = await Promise.all([
        pool.query(`select key, value from public.system_settings where key in ('maintenance_mode', 'maintenance_message', 'signup_enabled')`),
        pool.query(`select * from public.feature_flags order by kind, key`).catch((error) => {
            if (error?.code === '42703') return { rows: [] }; // before the control-centre migration
            throw error;
        }),
        pool.query(`select * from public.announcements where is_active and (ends_at is null or ends_at > now()) order by starts_at desc limit 50`)
            .catch((error) => {
                if (error?.code === '42P01') return { rows: [] };
                throw error;
            }),
    ]);
    const s = Object.fromEntries(settings.rows.map((r: any) => [r.key, r.value]));
    const message = settingValue(s.maintenance_message);
    return {
        maintenance: truthy(s.maintenance_mode, false),
        maintenanceMessage: typeof message === 'string' && message.trim() ? message : DEFAULT_MAINTENANCE_MESSAGE,
        signupsOpen: truthy(s.signup_enabled, true),
        flags: flags.rows.map(flagRow),
        announcements: announcements.rows.map(announcementRow),
    };
}

export const ControlCentre = {
    async state(): Promise<ControlState> {
        if (cached && Date.now() - cached.at < CACHE_MS) return cached.state;
        if (!loading) {
            loading = load()
                .then((state) => { cached = { at: Date.now(), state }; return state; })
                .finally(() => { loading = null; });
        }
        try {
            return await loading;
        } catch (error) {
            // The control centre must never take the product down with it: keep the last
            // known state, or run with everything on.
            logger.error('Control centre state could not be loaded', { error });
            return cached?.state ?? { maintenance: false, maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE, signupsOpen: true, flags: [], announcements: [] };
        }
    },

    /** Forget the cached state (after an admin change). */
    invalidate() {
        cached = null;
    },

    /** Whether a module's kill switch is on. Unknown modules are on. */
    async moduleOn(key: string): Promise<boolean> {
        const flag = (await this.state()).flags.find((f) => f.key === key);
        return !flag || flag.kind !== 'kill_switch' || flag.enabled;
    },

    /** What a learner (or visitor) gets: maintenance, sign-ups, flags evaluated for them, announcements for them. */
    async forViewer(userId: string | null | undefined) {
        const state = await this.state();
        const colleges = userId ? await ProblemsService.userColleges(userId).catch(() => []) : [];
        const orgIds = colleges.map((c) => c.org_id);
        const flags: Record<string, boolean> = {};
        for (const f of state.flags) flags[f.key] = evaluateFlag(f, userId, orgIds);
        const viewer = { signedIn: Boolean(userId), inCollege: orgIds.length > 0 };
        return {
            maintenance: { on: state.maintenance, message: state.maintenanceMessage },
            signupsOpen: state.signupsOpen,
            flags,
            announcements: state.announcements.filter((a) => announcementApplies(a, viewer)).map((a) => ({
                id: a.id, title: a.title, body: a.body, level: a.level, linkUrl: a.linkUrl, linkLabel: a.linkLabel, endsAt: a.endsAt,
            })),
        };
    },
};
