import { supabase } from '../config/database';
import logger from '../config/logger';

export async function updateStreak(userId: string) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, last_active_date, streak, longest_streak')
            .eq('id', userId)
            .single();

        if (error || !user) {
            throw error || new Error('User not found');
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let newStreak = user.streak || 0;
        const lastActiveRaw = user.last_active_date as string | null | undefined;

        if (!lastActiveRaw) {
            newStreak = 1;
        } else {
            const lastActiveDate = new Date(lastActiveRaw);
            const last = new Date(lastActiveDate.getFullYear(), lastActiveDate.getMonth(), lastActiveDate.getDate());
            const diffMs = today.getTime() - last.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // already counted for today
            } else if (diffDays === 1) {
                newStreak = (user.streak || 0) + 1;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
        }

        const longest = Math.max(user.longest_streak || 0, newStreak);

        const todayIso = today.toISOString();

        const { error: updateError } = await supabase
            .from('users')
            .update({
                streak: newStreak,
                longest_streak: longest,
                last_active_date: todayIso,
            })
            .eq('id', userId);

        if (updateError) {
            throw updateError;
        }

        return {
            streak: newStreak,
            longest_streak: longest,
        };
    } catch (error) {
        logger.error('Update streak error:', { userId, error });
        // Do not throw hard failure to avoid breaking main flows
        return {
            streak: 0,
            longest_streak: 0,
        };
    }
}

