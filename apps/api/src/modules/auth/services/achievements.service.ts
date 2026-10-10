import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import { indiaDate } from '../../learning/services/practiceHelpers';
import logger from '../../../config/logger';
import {
    indiaWeek, weekStats, missionViews, missionRewardKey, sanitizeMissions, codingStreak,
    milestonesReached, milestoneRewardKey, MILESTONES, collectionViews, displayName, dailyCap,
    type RewardStatus, type MissionDef,
} from '../../../utils/achievements';

/**
 * Weekly missions, coding streak, milestones, badge collections and the learner leaderboard (slice W2-G1).
 * Rewards are recorded in public.gamification_rewards and paid by public.grant_gamification_reward /
 * pay_gamification_reward (once each, within the daily XP limit) — migration 20261026000001.
 */

// Postgres errors meaning "that migration isn't applied here yet".
const NOT_INSTALLED = new Set(['42P01', '42883', '42703']);
const notInstalled = (e: any) => NOT_INSTALLED.has(e?.code);

/** Rows of a query, or [] when its table isn't there yet. */
const rows = (sql: string, params: unknown[]) =>
    pool.query(sql, params).then((r) => r.rows, (e) => { if (e?.code === '42P01') return []; throw e; });

const ELIGIBLE_ACCOUNT = `u.deleted_at is null and coalesce(u.is_banned, false) = false and u.role = 'user'`;
const ELIGIBLE = `${ELIGIBLE_ACCOUNT} and u.leaderboard_hidden = false`;
export type Period = 'all' | 'week';

export class ClaimError extends Error {
    constructor(message: string, public status: number, public code: string) { super(message); }
}

export class AchievementsService {
    static async settings(): Promise<{ missions: MissionDef[]; cap: number }> {
        const r = await pool.query(
            `select key, value from public.system_settings where key in ('gamification_config', 'max_daily_xp')`,
        ).catch((e) => { logger.warn('Gamification settings unavailable, using defaults', e); return { rows: [] as any[] }; });
        const byKey = new Map<string, any>(r.rows.map((x: any) => [x.key, x.value]));
        const cfg = byKey.get('gamification_config') ?? {};
        return { missions: sanitizeMissions(cfg?.weekly_missions), cap: dailyCap(byKey.get('max_daily_xp'), cfg?.reward_daily_xp_cap) };
    }

    /** Everything the progress rules need, from real activity tables. */
    static async activity(userId: string, weekStartsAt: string) {
        const ist = (col: string) => `((${col}) at time zone 'Asia/Kolkata')::date::text`;
        const [solvedWeek, chaptersWeek, study, codingDays, acceptedWeek, totals] = await Promise.all([
            rows(`select ${ist('solved_at')} as day from public.user_problem_status
                   where user_id = $1 and status = 'solved' and solved_at >= $2`, [userId, weekStartsAt]),
            rows(`select ${ist('completed_at')} as day from public.user_chapter_progress
                   where user_id = $1 and status = 'COMPLETED' and completed_at >= $2`, [userId, weekStartsAt]),
            rows(`select day::text as day, seconds from public.study_time_daily where user_id = $1 and day >= ($2::timestamptz at time zone 'Asia/Kolkata')::date`, [userId, weekStartsAt]),
            // Coding days: the latest solve of each problem, plus every accepted submission when that history exists.
            Promise.all([
                rows(`select distinct ${ist('solved_at')} as day from public.user_problem_status where user_id = $1 and status = 'solved' and solved_at is not null`, [userId]),
                rows(`select distinct ${ist('created_at')} as day from public.problem_submissions where user_id = $1 and verdict = 'Accepted'`, [userId]),
                rows(`select distinct ${ist('submitted_at')} as day from public.submissions where user_id = $1 and solved = true and submitted_at is not null`, [userId]),
            ]).then((parts) => parts.flat().map((r: any) => r.day as string)),
            rows(`select distinct ${ist('created_at')} as day from public.problem_submissions where user_id = $1 and verdict = 'Accepted' and created_at >= $2`, [userId, weekStartsAt]),
            rows(`select (select count(*)::int from public.user_problem_status where user_id = $1 and status = 'solved') as solved,
                         (select count(*)::int from public.user_chapter_progress where user_id = $1 and status = 'COMPLETED') as chapters`, [userId]),
        ]);
        return {
            week: {
                solveDays: solvedWeek.map((r: any) => r.day),
                chapterDays: chaptersWeek.map((r: any) => r.day),
                study: study.map((r: any) => ({ day: r.day, seconds: Number(r.seconds) })),
                otherActiveDays: acceptedWeek.map((r: any) => r.day),
            },
            codingDays,
            solved: Number(totals[0]?.solved ?? 0),
            chapters: Number(totals[0]?.chapters ?? 0),
        };
    }

    /** Records an earned reward (and badge) and tries to pay it. Returns the payment status, or null if rewards aren't installed. */
    static async grant(userId: string, key: string, kind: 'weekly_mission' | 'milestone' | 'daily_quest', xp: number,
        badge: { id: string; name: string; emoji: string } | null, cap: number): Promise<string | null> {
        try {
            const r = await pool.query(`select public.grant_gamification_reward($1, $2, $3, $4, $5, $6, $7, $8) as status`,
                [userId, key, kind, xp, badge?.id ?? null, badge?.name ?? null, badge?.emoji ?? null, cap]);
            const status = r.rows[0]?.status as string;
            if (status === 'paid') await AchievementsService.xpChanged(userId);
            return status;
        } catch (e) {
            if (notInstalled(e)) { logger.warn('Gamification rewards not installed (migration 20261026000001)', { code: (e as any).code }); return null; }
            throw e;
        }
    }

    /** Pays rewards held back by the daily limit, oldest first, while today's limit allows. */
    static async payPending(userId: string, cap: number) {
        const pending = await pool.query(
            `select reward_key from public.gamification_rewards where user_id = $1 and status = 'pending' order by claimed_at, reward_key limit 20`, [userId]);
        let paid = 0;
        for (const p of pending.rows) {
            const r = await pool.query(`select public.pay_gamification_reward($1, $2, $3) as status`, [userId, p.reward_key, cap]);
            if (r.rows[0]?.status === 'paid') paid++;
            else if (r.rows[0]?.status === 'capped') break;
        }
        if (paid > 0) await AchievementsService.xpChanged(userId);
    }

    static async xpChanged(userId: string) {
        await CacheService.del(`user:${userId}:stats`);
    }

    /** The learner's achievements page: this week's missions, coding streak, milestones (awarded here), collections. */
    static async get(userId: string) {
        const { missions, cap } = await AchievementsService.settings();
        const today = indiaDate();
        const week = indiaWeek(today);
        const act = await AchievementsService.activity(userId, week.startsAt);
        const stats = weekStats(act.week, week);
        const streak = codingStreak(act.codingDays, today);
        const reached = milestonesReached({ solved: act.solved, chapters: act.chapters, coding_streak: streak.longest });

        let rewardsEnabled = true;
        const newlyEarned: Array<{ id: string; name: string; emoji: string; xp: number }> = [];
        let rewards: Array<{ reward_key: string; status: RewardStatus; xp: number; paid_day: string | null; claimed_at: string }> = [];
        try {
            const existing = await pool.query(`select reward_key from public.gamification_rewards where user_id = $1 and kind = 'milestone'`, [userId]);
            const have = new Set(existing.rows.map((r: any) => r.reward_key));
            for (const m of reached) {
                if (have.has(milestoneRewardKey(m.id))) continue;
                const result = await AchievementsService.grant(userId, milestoneRewardKey(m.id), 'milestone', m.xp, m.badge, cap);
                if (result === 'paid' || result === 'capped') newlyEarned.push({ id: m.id, name: m.badge.name, emoji: m.badge.emoji, xp: m.xp });
            }
            await AchievementsService.payPending(userId, cap);
            rewards = (await pool.query(
                `select reward_key, status, xp, paid_day::text as paid_day, claimed_at from public.gamification_rewards where user_id = $1`, [userId])).rows;
        } catch (e) {
            if (!notInstalled(e)) throw e;
            rewardsEnabled = false;
        }
        const status = new Map<string, RewardStatus>(rewards.map((r) => [r.reward_key, r.status]));
        const badges = await pool.query(`select badge_id, earned_at from public.user_badges where user_id = $1`, [userId]);
        const earned = new Map<string, string>(badges.rows.map((b: any) => [b.badge_id, new Date(b.earned_at).toISOString()]));

        const paidToday = rewards.filter((r) => r.status === 'paid' && r.paid_day === today).reduce((s, r) => s + r.xp, 0);
        const pendingXp = rewards.filter((r) => r.status === 'pending').reduce((s, r) => s + r.xp, 0);
        const metricValue = { solved: act.solved, chapters: act.chapters, coding_streak: streak.longest };

        return {
            today,
            rewards_enabled: rewardsEnabled,
            week: { start: week.start, end: week.end, days_left: week.daysLeft, stats },
            missions: missionViews(missions, stats, status, week.start),
            coding_streak: streak,
            milestones: MILESTONES.map((m) => ({
                id: m.id, metric: m.metric, label: m.label, target: m.target, xp: m.xp, badge: m.badge,
                progress: Math.min(metricValue[m.metric], m.target),
                earned: earned.has(m.badge.id) || status.has(milestoneRewardKey(m.id)),
                earned_at: earned.get(m.badge.id) ?? null,
                reward: status.get(milestoneRewardKey(m.id)) ?? null,
            })),
            collections: collectionViews(earned),
            /** Milestones earned by this request (to announce once). */
            new_milestones: newlyEarned,
            xp_today: { paid: paidToday, cap, pending: pendingXp },
        };
    }

    /** Claims a finished weekly mission of the current India week. The server re-checks progress. */
    static async claimMission(userId: string, key: string) {
        const { missions, cap } = await AchievementsService.settings();
        const mission = missions.find((m) => m.key === key);
        if (!mission) throw new ClaimError('No such mission this week.', 404, 'NOT_FOUND');
        const week = indiaWeek(indiaDate());
        const act = await AchievementsService.activity(userId, week.startsAt);
        const stats = weekStats(act.week, week);
        if ((stats[mission.metric] ?? 0) < mission.target) throw new ClaimError('Finish this mission first.', 409, 'NOT_COMPLETE');
        const result = await AchievementsService.grant(userId, missionRewardKey(week.start, mission.key), 'weekly_mission', mission.xp, null, cap);
        if (result === null) throw new ClaimError('Rewards are not switched on yet. Your progress is saved.', 503, 'REWARDS_UNAVAILABLE');
        return { result, achievements: await AchievementsService.get(userId) };
    }

    // ─── Leaderboard ────────────────────────────────────────────────────────

    /** Takes this week's XP snapshot once (the weekly cron should do it at Monday 00:00 IST; this is the fallback). */
    static async ensureWeekSnapshot(weekStart: string) {
        const flag = `leaderboard:v2:snap:${weekStart}`;
        if (await CacheService.get(flag)) return;
        const has = await pool.query(`select 1 from public.xp_week_start where week_start = $1 limit 1`, [weekStart]);
        if (has.rows.length === 0) await pool.query(`select public.snapshot_week_xp($1)`, [weekStart]);
        await CacheService.set(flag, true, 6 * 3600);
    }

    static async snapshotWeek() {
        const { start } = indiaWeek(indiaDate());
        const r = await pool.query(`select public.snapshot_week_xp($1) as n`, [start]);
        await CacheService.set(`leaderboard:v2:snap:${start}`, true, 6 * 3600);
        return { week_start: start, recorded: Number(r.rows[0]?.n ?? 0) };
    }

    /** Score expression and join for a period. Week = XP now minus XP when the week began (0 for learners who joined since). */
    private static scoreSql(period: Period) {
        return period === 'week'
            ? { score: `greatest(coalesce(u.xp, 0) - coalesce(w.xp, 0), 0)`, join: `left join public.xp_week_start w on w.user_id = u.id and w.week_start = $1` }
            : { score: `coalesce(u.xp, 0)`, join: `` };
    }

    /** Top learners: rank, a privacy-safe name and XP. Learners who opted out, admins, banned and deleted accounts are left out. */
    static async top(period: Period, limit: number, weekStart: string) {
        const cacheKey = `leaderboard:v2:${period}:${period === 'week' ? weekStart : 'all'}:${limit}`;
        const cached = await CacheService.get<Array<{ id: string; rank: number; name: string; xp: number }>>(cacheKey);
        if (cached) return cached;
        const { score, join } = AchievementsService.scoreSql(period);
        const params: unknown[] = period === 'week' ? [weekStart, limit] : [limit];
        const r = await pool.query(
            `select id, full_name, score::int as xp, rank() over (order by score desc)::int as rank from (
               select u.id, u.full_name, u.created_at, ${score} as score from public.users u ${join} where ${ELIGIBLE}
             ) s where score > 0 order by score desc, created_at, id limit $${params.length}`, params);
        const top = r.rows.map((x: any) => ({ id: x.id as string, rank: x.rank as number, name: displayName(x.full_name), xp: x.xp as number }));
        await CacheService.set(cacheKey, top, 60);
        return top;
    }

    static async leaderboard(userId: string, period: Period, limit: number) {
        const { start } = indiaWeek(indiaDate());
        try {
            if (period === 'week') await AchievementsService.ensureWeekSnapshot(start);
            const top = await AchievementsService.top(period, limit, start);
            const { score, join } = AchievementsService.scoreSql(period);
            const meParams: unknown[] = period === 'week' ? [start, userId] : [userId];
            const me = (await pool.query(
                `select ${score}::int as xp, u.leaderboard_hidden as hidden, (${ELIGIBLE_ACCOUNT}) as eligible
                   from public.users u ${join} where u.id = $${meParams.length}`, meParams)).rows[0];
            let rank: number | null = null;
            let total = 0;
            const countParams: unknown[] = period === 'week' ? [start] : [];
            const countSql = (extra: string) => `select count(*)::int as n from public.users u ${join} where ${ELIGIBLE} and ${score} > 0 ${extra}`;
            total = (await pool.query(countSql(''), countParams)).rows[0]?.n ?? 0;
            if (me && !me.hidden && me.eligible && me.xp > 0) {
                const above = (await pool.query(countSql(`and ${score} > $${countParams.length + 1}`), [...countParams, me.xp])).rows[0]?.n ?? 0;
                rank = above + 1;
            }
            return {
                available: true,
                period,
                week_start: start,
                total,
                entries: top.map(({ id, ...e }) => ({ ...e, is_me: id === userId })),
                me: { rank, xp: me?.xp ?? 0, hidden: Boolean(me?.hidden) },
            };
        } catch (e) {
            if (!notInstalled(e)) throw e;
            return { available: false, period, week_start: start, total: 0, entries: [], me: { rank: null, xp: 0, hidden: false } };
        }
    }

    /** The old public /leaderboard: same privacy rules, top all-time only, names and XP only. */
    static async publicTop(limit: number) {
        try {
            return (await AchievementsService.top('all', limit, indiaWeek(indiaDate()).start)).map(({ id: _id, ...e }) => e);
        } catch (e) {
            if (notInstalled(e)) return [];
            throw e;
        }
    }

    static async setHidden(userId: string, hidden: boolean) {
        try {
            await pool.query(`update public.users set leaderboard_hidden = $2, updated_at = now() where id = $1`, [userId, hidden]);
        } catch (e) {
            if (notInstalled(e)) throw new ClaimError('Leaderboard settings are not switched on yet.', 503, 'REWARDS_UNAVAILABLE');
            throw e;
        }
        await CacheService.delPattern('leaderboard:v2:*');
        return { hidden };
    }
}

