import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import { calculateXP, calculateLevel, calculateStreakBonus } from '../utils/xp';
import logger from '../config/logger';

export class SubmissionsService {
    /**
     * Submit solution for a problem
     */
    static async submitSolution(
        user_id: string,
        problem_id: string,
        code: string,
        language: string,
        time_spent_seconds?: number
    ) {
        try {
            // Get problem details
            const { data: problem, error: problemError } = await supabase
                .from('problems')
                .select('difficulty, solved_count')
                .eq('id', problem_id)
                .single();

            if (problemError) throw problemError;

            // Check if already solved
            const { data: existing } = await supabase
                .from('submissions')
                .select('solved')
                .eq('user_id', user_id)
                .eq('problem_id', problem_id)
                .single();

            const isFirstSolve = !existing || !existing.solved;

            // Upsert submission
            const { data: submission, error: submissionError } = await supabase
                .from('submissions')
                .upsert({
                    user_id,
                    problem_id,
                    code,
                    language,
                    solved: true,
                    time_spent_seconds,
                    submitted_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id, problem_id',
                })
                .select()
                .single();

            if (submissionError) throw submissionError;

            // Calculate XP gained
            const xpGained = isFirstSolve ? calculateXP(problem.difficulty as any, true) : 0;

            if (isFirstSolve) {
                // Update user XP and streak
                await this.updateUserProgress(user_id, xpGained);

                // Update problem solved count
                await supabase
                    .from('problems')
                    .update({ solved_count: problem.solved_count + 1 })
                    .eq('id', problem_id);

                // Invalidate caches
                await CacheService.delPattern(`problems:*`);
                await CacheService.delPattern(`user:${user_id}:*`);
            }

            return {
                submission,
                xp_gained: xpGained,
                is_first_solve: isFirstSolve,
            };
        } catch (error) {
            logger.error('Submit solution error:', { user_id, problem_id, error });
            throw new Error('Failed to submit solution');
        }
    }

    /**
     * Update user progress (XP, streak, level)
     */
    private static async updateUserProgress(user_id: string, xp_gained: number) {
        try {
            // Get current user data
            const { data: user } = await supabase
                .from('users')
                .select('xp, streak, longest_streak, last_active_date')
                .eq('id', user_id)
                .single();

            if (!user) throw new Error('User not found');

            const today = new Date().toISOString().split('T')[0];
            const lastActive = user.last_active_date
                ? new Date(user.last_active_date).toISOString().split('T')[0]
                : null;

            // Calculate streak
            let newStreak = user.streak;
            let newLongestStreak = user.longest_streak;

            if (lastActive !== today) {
                if (!lastActive) {
                    // First activity
                    newStreak = 1;
                } else {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];

                    if (lastActive === yesterdayStr) {
                        // Continued streak
                        newStreak = user.streak + 1;
                    } else {
                        // Broke streak
                        newStreak = 1;
                    }
                }

                // Update longest streak
                if (newStreak > newLongestStreak) {
                    newLongestStreak = newStreak;
                }
            }

            // Add streak bonus XP
            const streakBonus = calculateStreakBonus(newStreak);
            const totalXP = user.xp + xp_gained + streakBonus;

            // Calculate new level
            const newLevel = calculateLevel(totalXP);

            // Update user
            await supabase
                .from('users')
                .update({
                    xp: totalXP,
                    level: newLevel,
                    streak: newStreak,
                    longest_streak: newLongestStreak,
                    last_active_date: today,
                })
                .eq('id', user_id);

            logger.info('User progress updated', {
                user_id,
                xp_gained,
                streak_bonus: streakBonus,
                new_xp: totalXP,
                new_level: newLevel,
                new_streak: newStreak,
            });
        } catch (error) {
            logger.error('Update user progress error:', { user_id, error });
            throw error;
        }
    }

    /**
     * Add notes to submission
     */
    static async addNotes(user_id: string, problem_id: string, notes: string) {
        try {
            const { data, error } = await supabase
                .from('submissions')
                .update({
                    notes,
                    has_notes: true,
                })
                .eq('user_id', user_id)
                .eq('problem_id', problem_id)
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            await CacheService.delPattern(`problems:*`);

            return data;
        } catch (error) {
            logger.error('Add notes error:', { user_id, problem_id, error });
            throw new Error('Failed to add notes');
        }
    }

    /**
     * Toggle revision marker
     */
    static async toggleRevision(user_id: string, problem_id: string) {
        try {
            // Get current state
            const { data: current } = await supabase
                .from('submissions')
                .select('marked_for_revision')
                .eq('user_id', user_id)
                .eq('problem_id', problem_id)
                .single();

            if (!current) {
                throw new Error('Submission not found');
            }

            // Toggle
            const { data, error } = await supabase
                .from('submissions')
                .update({
                    marked_for_revision: !current.marked_for_revision,
                })
                .eq('user_id', user_id)
                .eq('problem_id', problem_id)
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            await CacheService.delPattern(`problems:*`);

            return data;
        } catch (error) {
            logger.error('Toggle revision error:', { user_id, problem_id, error });
            throw new Error('Failed to toggle revision');
        }
    }

    /**
     * Get leaderboard
     */
    static async getLeaderboard(limit: number = 100) {
        // Try cache first
        const cacheKey = `leaderboard:${limit}`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, avatar_url, xp, level, streak')
                .order('xp', { ascending: false })
                .limit(limit);

            if (error) throw error;

            const leaderboard = data?.map((user, index) => ({
                rank: index + 1,
                user_id: user.id,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                xp: user.xp,
                level: user.level,
                streak: user.streak,
            })) || [];

            // Cache for 10 minutes
            await CacheService.set(cacheKey, leaderboard, 600);

            return leaderboard;
        } catch (error) {
            logger.error('Get leaderboard error:', error);
            throw new Error('Failed to fetch leaderboard');
        }
    }
}
