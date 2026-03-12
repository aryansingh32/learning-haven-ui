import { supabase } from '../config/database';
import logger from '../config/logger';

export const checkBadges = async (userId: string) => {
    try {
        const badgesToAward: Array<{ user_id: string; badge_type: string }> = [];

        // 1. Fetch user data
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('streak_count')
            .eq('id', userId)
            .single();

        if (userErr || !user) {
            logger.error('Error fetching user for badges', userErr);
            return;
        }

        // 2. Fetch completed chapters
        const { data: completedChapters, error: chaptersErr } = await supabase
            .from('user_chapter_progress')
            .select('chapter_id, completed_at')
            .eq('user_id', userId)
            .eq('status', 'COMPLETED');

        if (chaptersErr) {
            logger.error('Error fetching chapters for badges', chaptersErr);
            return;
        }

        const chapterCount = completedChapters?.length || 0;

        // Check 'first_step'
        if (chapterCount >= 1) {
            badgesToAward.push({ user_id: userId, badge_type: 'first_step' });
        }

        // Check 'week_streak'
        if (user.streak_count >= 7) {
            badgesToAward.push({ user_id: userId, badge_type: 'week_streak' });
        }

        // Check 'dsa_champion'
        if (chapterCount >= 18) {
            badgesToAward.push({ user_id: userId, badge_type: 'dsa_champion' });
        }

        // Check 'fast_learner' (5 in 7 days)
        if (chapterCount >= 5) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentCompletions = completedChapters.filter(c => {
                return c.completed_at && new Date(c.completed_at) >= sevenDaysAgo;
            });

            if (recentCompletions.length >= 5) {
                badgesToAward.push({ user_id: userId, badge_type: 'fast_learner' });
            }
        }

        // Award badges
        if (badgesToAward.length > 0) {
            const { error: upsertErr } = await supabase
                .from('user_badges')
                .upsert(badgesToAward, { onConflict: 'user_id, badge_type', ignoreDuplicates: true });

            if (upsertErr) {
                logger.error('Error awarding badges', upsertErr);
            }
        }
    } catch (err) {
        logger.error('Check badges failed', err);
    }
};
