import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import { ChaptersService } from '../../learning/services/chapters.service';
import { calculateLevel } from '../../../utils/xp';
import { DEFAULT_GAMIFICATION_CONFIG, GamificationConfig } from '../../../utils/gamification.constants';
import logger from '../../../config/logger';

type ChapterRow = {
    id: string;
    title: string;
    chapter_number: number;
    topic_tag?: string;
    status: string;
    total_steps: number;
    completed_steps: number;
};

export class GamificationService {
    static async getConfig(): Promise<GamificationConfig> {
        try {
            const result = await pool.query(
                `SELECT value FROM public.system_settings WHERE key = 'gamification_config'`
            );
            if (result.rows[0]?.value) {
                return { ...DEFAULT_GAMIFICATION_CONFIG, ...result.rows[0].value };
            }
        } catch (err) {
            logger.warn('Failed to load gamification config, using defaults', err);
        }
        return DEFAULT_GAMIFICATION_CONFIG;
    }

    static async getActiveCourse(userId: string) {
        const onboarding = await pool.query(
            `SELECT onboarding_answers FROM public.users WHERE id = $1`,
            [userId]
        );
        const answers = onboarding.rows[0]?.onboarding_answers || {};
        const preferredPath = answers?.learning_path || answers?.goal;

        const courses = await pool.query(
            `SELECT id, title, slug, description FROM public.courses
             WHERE is_published = true
             ORDER BY created_at ASC`
        );

        if (courses.rows.length === 0) return null;

        if (preferredPath) {
            const match = courses.rows.find((r: { title: string; slug: string }) =>
                r.title?.toLowerCase().includes(String(preferredPath).toLowerCase()) ||
                r.slug?.toLowerCase().includes(String(preferredPath).toLowerCase())
            );
            if (match) return match;
        }

        return courses.rows[0];
    }

    static async getChapterContext(userId: string) {
        const course = await this.getActiveCourse(userId);
        if (!course) {
            return { course: null, chapters: [] as ChapterRow[] };
        }

        const chapters = (await ChaptersService.getCourseChaptersForUser(userId, course.id)) as ChapterRow[];
        return { course, chapters };
    }

    static resolveIdentity(
        level: number,
        completedTopicTags: string[],
        config: GamificationConfig
    ) {
        const titles = [...config.identity_titles].reverse();
        for (const entry of titles) {
            const levelOk = level >= entry.minLevel && level <= entry.maxLevel;
            const tagsOk =
                !entry.requiredChapterTags?.length ||
                entry.requiredChapterTags.every((tag) =>
                    completedTopicTags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
                );
            if (levelOk && tagsOk) {
                return { id: entry.id, title: entry.title, minLevel: entry.minLevel, maxLevel: entry.maxLevel };
            }
        }
        return { id: 'novice', title: 'Novice Coder', minLevel: 1, maxLevel: 5 };
    }

    static async getIdentity(userId: string) {
        const config = await this.getConfig();
        const userResult = await pool.query(
            `SELECT xp, streak, longest_streak, streak_freeze_count FROM public.users WHERE id = $1`,
            [userId]
        );
        const user = userResult.rows[0];
        const level = calculateLevel(user?.xp || 0);

        const { chapters } = await this.getChapterContext(userId);
        const completedTags = chapters
            .filter((c) => c.status === 'COMPLETED')
            .map((c) => (c.topic_tag || c.title || '').toLowerCase());

        const identity = this.resolveIdentity(level, completedTags, config);

        const badgesResult = await pool.query(
            `SELECT badge_id, badge_name, badge_emoji, earned_at FROM public.user_badges WHERE user_id = $1 ORDER BY earned_at DESC`,
            [userId]
        );

        return {
            level,
            xp: user?.xp || 0,
            streak: user?.streak || 0,
            longest_streak: user?.longest_streak || 0,
            streak_freeze_count: user?.streak_freeze_count ?? 1,
            identity,
            badges: badgesResult.rows,
            badge_catalog: config.badges,
        };
    }

    static async getMission(userId: string) {
        const config = await this.getConfig();
        const { course, chapters } = await this.getChapterContext(userId);

        if (!course || chapters.length === 0) {
            return {
                title: 'Start Your Journey',
                pathTitle: 'Programming Foundations',
                progress: 0,
                currentStage: null,
                nextTask: 'Explore courses and pick your first learning path',
                reward: { xp: 100, label: '+100 XP on first chapter complete' },
                continueUrl: '/courses',
                career: await this.getCareerSnapshot(userId),
            };
        }

        const completed = chapters.filter((c) => c.status === 'COMPLETED');
        const progress = Math.round((completed.length / chapters.length) * 100);

        const active =
            chapters.find((c) => c.status === 'IN_PROGRESS') ||
            chapters.find((c) => (c.status === 'UNLOCKED' || c.status === 'IN_PROGRESS') && c.completed_steps < c.total_steps) ||
            chapters.find((c) => c.status !== 'COMPLETED' && c.status !== 'LOCKED');

        const lastCompleted = [...completed].sort((a, b) => b.chapter_number - a.chapter_number)[0];
        const nextAfterComplete = lastCompleted
            ? chapters.find((c) => c.chapter_number === lastCompleted.chapter_number + 1 && c.status !== 'LOCKED')
            : null;

        let currentStage = active?.title || lastCompleted?.title || chapters[0]?.title;
        let nextTask = 'Begin your first chapter';
        let continueUrl = active ? `/chapter/${active.id}` : `/course/${course.id}/chapters`;
        let rewardXp = 200;

        if (active) {
            if (active.completed_steps > 0 && active.completed_steps < active.total_steps) {
                nextTask = `Continue "${active.title}" — ${active.completed_steps}/${active.total_steps} steps done`;
            } else if (active.status === 'UNLOCKED') {
                nextTask = `Start "${active.title}"`;
            } else {
                nextTask = `Complete remaining steps in "${active.title}"`;
            }
            rewardXp = Math.max(50, (active.total_steps - active.completed_steps) * 25);
        } else if (lastCompleted && nextAfterComplete) {
            currentStage = lastCompleted.title;
            nextTask = `Start next chapter: "${nextAfterComplete.title}"`;
            continueUrl = `/chapter/${nextAfterComplete.id}`;
        } else if (completed.length === chapters.length) {
            nextTask = 'Path complete! Explore advanced courses or build projects';
            continueUrl = '/projects';
            rewardXp = 500;
        }

        return {
            title: course.title,
            pathTitle: course.title,
            progress,
            currentStage,
            nextTask,
            reward: { xp: rewardXp, label: `+${rewardXp} XP` },
            continueUrl,
            chapterId: active?.id || nextAfterComplete?.id || null,
            courseId: course.id,
            chaptersCompleted: completed.length,
            chaptersTotal: chapters.length,
            career: await this.getCareerSnapshot(userId),
            weeklyGoal: config.weekly_goal_problems,
        };
    }

    static async getCareerSnapshot(userId: string) {
        const stats = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE ups.status = 'solved') AS solved
             FROM public.user_problem_status ups WHERE ups.user_id = $1`,
            [userId]
        );
        const projects = await pool.query(
            `SELECT COUNT(*) AS count FROM public.build_enrollments WHERE user_id = $1`,
            [userId]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        const solved = Number(stats.rows[0]?.solved || 0);
        const projectsBuilt = Number(projects.rows[0]?.count || 0);
        const interviewReadiness = Math.min(100, Math.round(solved * 2 + projectsBuilt * 10));

        return {
            skillsLearned: solved,
            projectsBuilt,
            interviewReadiness,
            salaryBand: interviewReadiness >= 50 ? '₹6–12 LPA' : interviewReadiness >= 25 ? '₹4–8 LPA' : '₹3–6 LPA',
        };
    }

    static todayDateStr() {
        return new Date().toISOString().split('T')[0];
    }

    static async syncDailyQuestProgress(userId: string, quests: Array<{ key: string; label: string; xp: number; completed: boolean; completed_at?: string | null }>) {
        const today = this.todayDateStr();

        const conceptDone = await pool.query(
            `SELECT 1 FROM public.user_chapter_progress
             WHERE user_id = $1
               AND (
                 completed_at::date = $2::date
                 OR unlocked_at::date = $2::date
               )
             LIMIT 1`,
            [userId, today]
        );
        const problemDone = await pool.query(
            `SELECT 1 FROM public.user_problem_status
             WHERE user_id = $1 AND status = 'solved' AND solved_at::date = $2::date LIMIT 1`,
            [userId, today]
        );
        const challengeDone = await pool.query(
            `SELECT 1 FROM public.build_enrollments
             WHERE user_id = $1 AND updated_at::date = $2::date LIMIT 1`,
            [userId, today]
        ).catch(() => ({ rows: [] }));

        const autoComplete: Record<string, boolean> = {
            read_concept: conceptDone.rows.length > 0,
            solve_problem: problemDone.rows.length > 0,
            complete_challenge: challengeDone.rows.length > 0,
        };

        return quests.map((q) => {
            if (q.completed) return q;
            if (autoComplete[q.key]) {
                return { ...q, completed: true, completed_at: new Date().toISOString() };
            }
            return q;
        });
    }

    static async getDailyQuests(userId: string) {
        const config = await this.getConfig();
        const today = this.todayDateStr();
        const bonusXp = config.daily_quest_bonus_xp;

        let row = await pool.query(
            `SELECT * FROM public.user_daily_quests WHERE user_id = $1 AND quest_date = $2`,
            [userId, today]
        );

        if (row.rows.length === 0) {
            const quests = config.daily_quest_templates.map((t) => ({
                key: t.key,
                label: t.label,
                xp: t.xp,
                completed: false,
                completed_at: null as string | null,
            }));

            const synced = await this.syncDailyQuestProgress(userId, quests);

            const insert = await pool.query(
                `INSERT INTO public.user_daily_quests (user_id, quest_date, quests, reward_xp)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, today, JSON.stringify(synced), bonusXp]
            );
            row = insert;
        } else {
            const synced = await this.syncDailyQuestProgress(userId, row.rows[0].quests);
            const allComplete = synced.every((q) => q.completed);
            const update = await pool.query(
                `UPDATE public.user_daily_quests SET quests = $1, updated_at = now() WHERE id = $2 RETURNING *`,
                [JSON.stringify(synced), row.rows[0].id]
            );
            row = update;

            if (allComplete && !row.rows[0].reward_claimed) {
                await pool.query(
                    `UPDATE public.users SET xp = xp + $1 WHERE id = $2`,
                    [bonusXp, userId]
                );
                await pool.query(
                    `UPDATE public.user_daily_quests SET reward_claimed = true WHERE id = $1`,
                    [row.rows[0].id]
                );
                await CacheService.del(`user:${userId}:stats`);
                row.rows[0].reward_claimed = true;
            }
        }

        const record = row.rows[0];
        const quests = record.quests as Array<{ key: string; label: string; xp: number; completed: boolean }>;
        const completedCount = quests.filter((q) => q.completed).length;

        return {
            date: record.quest_date,
            quests,
            completedCount,
            totalCount: quests.length,
            allComplete: completedCount === quests.length,
            rewardXp: record.reward_xp,
            rewardClaimed: record.reward_claimed,
            bonusXp,
        };
    }

    static async completeDailyQuest(userId: string, questKey: string) {
        const today = this.todayDateStr();
        const row = await pool.query(
            `SELECT * FROM public.user_daily_quests WHERE user_id = $1 AND quest_date = $2`,
            [userId, today]
        );
        if (row.rows.length === 0) {
            await this.getDailyQuests(userId);
            return this.completeDailyQuest(userId, questKey);
        }

        const quests = row.rows[0].quests as Array<{ key: string; label: string; xp: number; completed: boolean; completed_at?: string | null }>;
        const updated = quests.map((q) =>
            q.key === questKey ? { ...q, completed: true, completed_at: new Date().toISOString() } : q
        );

        await pool.query(
            `UPDATE public.user_daily_quests SET quests = $1, updated_at = now() WHERE id = $2`,
            [JSON.stringify(updated), row.rows[0].id]
        );

        return this.getDailyQuests(userId);
    }

    static async getMentorContext(userId: string) {
        const { course, chapters } = await this.getChapterContext(userId);
        const userResult = await pool.query(
            `SELECT last_active_date, streak, xp FROM public.users WHERE id = $1`,
            [userId]
        );
        const user = userResult.rows[0];

        const lastActive = user?.last_active_date ? new Date(user.last_active_date) : null;
        const daysInactive = lastActive
            ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const inProgress = chapters.find((c) => c.status === 'IN_PROGRESS' || (c.status === 'UNLOCKED' && c.completed_steps > 0));
        const active = inProgress || chapters.find((c) => c.status === 'UNLOCKED' || c.status === 'IN_PROGRESS');
        const lastCompleted = [...chapters.filter((c) => c.status === 'COMPLETED')].sort(
            (a, b) => b.chapter_number - a.chapter_number
        )[0];
        const nextChapter = lastCompleted
            ? chapters.find((c) => c.chapter_number === lastCompleted.chapter_number + 1 && c.status !== 'LOCKED')
            : chapters.find((c) => c.status === 'UNLOCKED' || c.status === 'IN_PROGRESS');

        const solvedToday = await pool.query(
            `SELECT COUNT(*) AS count FROM public.user_problem_status
             WHERE user_id = $1 AND status = 'solved' AND solved_at::date = CURRENT_DATE`,
            [userId]
        );
        const failedRecent = await pool.query(
            `SELECT p.topic, COUNT(*) AS attempts
             FROM public.submissions s
             JOIN public.problems p ON p.id = s.problem_id
             WHERE s.user_id = $1 AND s.solved = false AND s.submitted_at > NOW() - INTERVAL '7 days'
             GROUP BY p.topic ORDER BY attempts DESC LIMIT 1`,
            [userId]
        ).catch(() => ({ rows: [] }));

        let scenario: 'welcome_back' | 'continue' | 'start' | 'next_chapter' | 'struggling' | 'idle' = 'idle';
        let message = '';
        const actions: Array<{ label: string; action: string; url?: string; prompt?: string }> = [];

        if (chapters.length === 0 || !course) {
            scenario = 'start';
            message = "Welcome! Let's find your starting point. Pick a learning path and I'll guide you step by step.";
            actions.push(
                { label: 'Browse Courses', action: 'navigate', url: '/courses' },
                { label: 'Take Assessment', action: 'navigate', url: '/onboarding' },
            );
        } else if (daysInactive !== null && daysInactive >= 5 && active) {
            scenario = 'welcome_back';
            message = `Welcome back! You were working on **${active.title}**. Let's spend 10 minutes and continue where you left off.`;
            actions.push(
                { label: 'Resume Learning', action: 'navigate', url: `/chapter/${active.id}` },
                { label: 'Review Progress', action: 'navigate', url: `/course/${course.id}/chapters` },
            );
        } else if (inProgress && inProgress.completed_steps > 0) {
            scenario = 'continue';
            message = `You're making progress on **${inProgress.title}** (${inProgress.completed_steps}/${inProgress.total_steps} steps). Ready to continue?`;
            actions.push(
                { label: 'Continue Chapter', action: 'navigate', url: `/chapter/${inProgress.id}` },
                { label: 'Ask a Question', action: 'prompt', prompt: `I'm working on ${inProgress.title}. Can you help me understand the key concept?` },
            );
        } else if (active && active.status === 'UNLOCKED') {
            scenario = 'continue';
            message = `Your next step is **${active.title}** on the ${course.title} path. Want to start now?`;
            actions.push(
                { label: 'Start Chapter', action: 'navigate', url: `/chapter/${active.id}` },
                { label: 'Skip for Now', action: 'dismiss' },
            );
        } else if (lastCompleted && nextChapter) {
            scenario = 'next_chapter';
            message = `You completed **${lastCompleted.title}**. Next up: **${nextChapter.title}**. Most learners find this a natural next step.`;
            actions.push(
                { label: 'Start Next Chapter', action: 'navigate', url: `/chapter/${nextChapter.id}` },
                { label: 'Review Previous', action: 'navigate', url: `/chapter/${lastCompleted.id}` },
                { label: 'Practice Problems', action: 'prompt', prompt: `Give me 3 practice problems related to ${lastCompleted.title}` },
            );
        } else if (failedRecent.rows[0]?.attempts >= 3) {
            scenario = 'struggling';
            const topic = failedRecent.rows[0].topic;
            message = `I noticed you're having trouble with **${topic}** problems. Would you like help?`;
            actions.push(
                { label: 'Visual Explanation', action: 'prompt', prompt: `Explain ${topic} with a visual analogy for a beginner` },
                { label: 'Simplified Explanation', action: 'prompt', prompt: `Explain ${topic} in the simplest way possible with an example` },
                { label: 'Similar Question', action: 'prompt', prompt: `Give me an easy ${topic} practice problem with hints` },
            );
        } else if (Number(solvedToday.rows[0]?.count || 0) === 0) {
            scenario = 'start';
            message = `Ready for today's mission? Start with a concept or solve one problem to keep your streak alive.`;
            actions.push(
                { label: 'Continue Mission', action: 'navigate', url: '/dashboard' },
                { label: 'Solve a Problem', action: 'prompt', prompt: 'Recommend one easy DSA problem for me to solve today' },
            );
        } else {
            scenario = 'idle';
            message = `I'm here when you need me. Ask about any DSA topic, or use the quick actions below.`;
            actions.push(
                { label: 'Daily Quests', action: 'navigate', url: '/dashboard' },
                { label: 'Explain a Topic', action: 'prompt', prompt: 'What DSA topic should I focus on next based on my level?' },
            );
        }

        return {
            scenario,
            message,
            actions,
            context: {
                courseTitle: course?.title || null,
                activeChapter: active?.title || null,
                lastCompletedChapter: lastCompleted?.title || null,
                streak: user?.streak || 0,
                daysInactive,
            },
        };
    }
}
