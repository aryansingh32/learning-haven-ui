
import { supabase } from '../config/database';
import logger from '../config/logger';

const BADGE_LABELS: Record<string, { name: string; emoji: string }> = {
    first_step: { name: 'First Step', emoji: '🎯' },
    week_streak: { name: 'Week Streak', emoji: '🔥' },
    dsa_champion: { name: 'DSA Champion', emoji: '🏆' },
    fast_learner: { name: 'Fast Learner', emoji: '⚡' },
};

export const checkBadges = async (userId: string) => {
    try {
        const badgesToAward: Array<{
            user_id: string;
            badge_id: string;
            badge_name: string;
            badge_emoji: string;
        }> = [];

        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('streak_count')
            .eq('id', userId)
            .single();

        if (userErr || !user) {
            logger.error('Error fetching user for badges', userErr);
            return null;
        }

        const { data: completedChapters, error: chaptersErr } = await supabase
            .from('user_chapter_progress')
            .select('chapter_id, completed_at')
            .eq('user_id', userId)
            .eq('status', 'COMPLETED');

        if (chaptersErr) {
            logger.error('Error fetching chapters for badges', chaptersErr);
            return null;
        }

        const chapterCount = completedChapters?.length || 0;

        if (chapterCount >= 1) {
            badgesToAward.push({
                user_id: userId,
                badge_id: 'first_step',
                badge_name: BADGE_LABELS.first_step.name,
                badge_emoji: BADGE_LABELS.first_step.emoji,
            });
        }

        if (user.streak_count >= 7) {
            badgesToAward.push({
                user_id: userId,
                badge_id: 'week_streak',
                badge_name: BADGE_LABELS.week_streak.name,
                badge_emoji: BADGE_LABELS.week_streak.emoji,
            });
        }

        if (chapterCount >= 18) {
            badgesToAward.push({
                user_id: userId,
                badge_id: 'dsa_champion',
                badge_name: BADGE_LABELS.dsa_champion.name,
                badge_emoji: BADGE_LABELS.dsa_champion.emoji,
            });
        }

        if (chapterCount >= 5) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentCompletions = (completedChapters || []).filter((c) => {
                return c.completed_at && new Date(c.completed_at) >= sevenDaysAgo;
            });

            if (recentCompletions.length >= 5) {
                badgesToAward.push({
                    user_id: userId,
                    badge_id: 'fast_learner',
                    badge_name: BADGE_LABELS.fast_learner.name,
                    badge_emoji: BADGE_LABELS.fast_learner.emoji,
                });
            }
        }

        if (badgesToAward.length > 0) {
            const { error: upsertErr } = await supabase
                .from('user_badges')
                .upsert(badgesToAward, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });

            if (upsertErr) {
                logger.error('Error awarding badges', upsertErr);
            }
        }

        return badgesToAward.length > 0 ? badgesToAward[badgesToAward.length - 1] : null;
    } catch (err) {
        logger.error('Check badges failed', err);
        return null;
    }
};
