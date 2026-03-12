import { supabase } from '../config/database';
import logger from '../config/logger';

/**
 * Helper to update user streak.
 * Run when a chapter is unlocked/completed.
 */
export const updateStreak = async (userId: string) => {
    try {
        const { data: user, error: fetchErr } = await supabase
            .from('users')
            .select('last_active_date, streak_count')
            .eq('id', userId)
            .single();

        if (fetchErr || !user) {
            logger.error('Error fetching user for streak update', fetchErr);
            return { streak: 0 };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let lastActive = null;
        if (user.last_active_date) {
            lastActive = new Date(user.last_active_date);
            lastActive.setHours(0, 0, 0, 0);
        }

        let newStreak = user.streak_count || 0;

        if (!lastActive) {
            // First time active
            newStreak = 1;
        } else {
            const diffTime = Math.abs(today.getTime() - lastActive.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Active yesterday
                newStreak += 1;
            } else if (diffDays > 1) {
                // Missed a day
                newStreak = 1;
            }
            // If diffDays === 0, they already updated today, no change
        }

        const { error: updateErr } = await supabase
            .from('users')
            .update({
                last_active_date: new Date().toISOString(),
                streak_count: newStreak
            })
            .eq('id', userId);

        if (updateErr) {
            logger.error('Error updating streak', updateErr);
        }

        return { streak: newStreak };
    } catch (err) {
        logger.error('Update streak failed', err);
        return { streak: 0 };
    }
};
