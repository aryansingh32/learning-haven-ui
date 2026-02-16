import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import { calculateLevel, xpToNextLevel } from '../utils/xp';
import logger from '../config/logger';

export class UsersService {
    /**
     * Get user profile
     */
    static async getProfile(user_id: string) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user_id)
                .single();

            if (error) throw error;

            // Calculate level
            const level_info = xpToNextLevel(data.xp);

            return {
                id: data.id,
                email: data.email,
                full_name: data.full_name,
                avatar_url: data.avatar_url,
                phone: data.phone,
                current_plan: data.current_plan,
                plan_expires_at: data.plan_expires_at,
                xp: data.xp,
                level: level_info.current_level,
                level_progress: level_info.progress,
                xp_to_next_level: level_info.xp_needed,
                streak: data.streak,
                longest_streak: data.longest_streak,
                referral_code: data.referral_code,
                wallet_balance: data.wallet_balance,
                preferences: data.preferences,
                role: data.role,
                created_at: data.created_at,
            };
        } catch (error) {
            logger.error('Error fetching profile:', { user_id, error });
            throw new Error('Failed to fetch profile');
        }
    }

    /**
     * Update user profile
     */
    static async updateProfile(user_id: string, updates: any) {
        try {
            // Clear cache
            await CacheService.del(`user:${user_id}:stats`);
            await CacheService.del(`user:${user_id}:progress`);

            const { data, error } = await supabase
                .from('users')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user_id)
                .select()
                .single();

            if (error) throw error;

            return this.getProfile(user_id);
        } catch (error) {
            logger.error('Error updating profile:', { user_id, error });
            throw new Error('Failed to update profile');
        }
    }

    /**
     * Get user statistics
     */
    static async getStats(user_id: string) {
        // Try cache first
        const cacheKey = `user:${user_id}:stats`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get user data
            const { data: user } = await supabase
                .from('users')
                .select('xp, streak, longest_streak')
                .eq('id', user_id)
                .single();

            // Get submission counts by status
            const { data: problemStatus } = await supabase
                .from('user_problem_status')
                .select('status, problems(difficulty)')
                .eq('user_id', user_id);

            const solved = problemStatus?.filter(s => s.status === 'solved') || [];
            const tried = problemStatus?.filter(s => s.status === 'tried') || [];
            const revision = problemStatus?.filter(s => s.status === 'revision') || [];

            const stats = {
                total_solved: solved.length,
                total_tried: tried.length,
                total_revision: revision.length,
                easy_solved: solved.filter(s => (s.problems as any)?.difficulty === 'easy').length,
                medium_solved: solved.filter(s => (s.problems as any)?.difficulty === 'medium').length,
                hard_solved: solved.filter(s => (s.problems as any)?.difficulty === 'hard').length,
                xp: user?.xp || 0,
                level: calculateLevel(user?.xp || 0),
                streak: user?.streak || 0,
                longest_streak: user?.longest_streak || 0,
            };

            // Cache for 5 minutes
            await CacheService.set(cacheKey, stats, 300);

            return stats;
        } catch (error) {
            logger.error('Error fetching stats:', { user_id, error });
            throw new Error('Failed to fetch statistics');
        }
    }

    /**
     * Get user progress by topic
     */
    static async getProgress(user_id: string) {
        // Try cache first
        const cacheKey = `user:${user_id}:progress`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get all topics with problem counts
            const { data: topics } = await supabase
                .from('problems')
                .select('topic, difficulty, id')
                .order('topic');

            // Get user's problem status
            const { data: userStatus } = await supabase
                .from('user_problem_status')
                .select('problem_id, status, problems(topic, difficulty)')
                .eq('user_id', user_id)
                .eq('status', 'solved');

            // Group by topic
            const topicMap = new Map<string, any>();

            // Helper for weighted score
            const getWeight = (difficulty: string) => {
                if (difficulty === 'easy') return 1;
                if (difficulty === 'medium') return 2;
                if (difficulty === 'hard') return 3;
                return 1;
            };

            topics?.forEach(problem => {
                if (!topicMap.has(problem.topic)) {
                    topicMap.set(problem.topic, {
                        topic: problem.topic,
                        total: 0,
                        solved: 0,
                        total_weight: 0,
                        solved_weight: 0,
                        easy_total: 0,
                        easy_solved: 0,
                        medium_total: 0,
                        medium_solved: 0,
                        hard_total: 0,
                        hard_solved: 0,
                    });
                }

                const topic = topicMap.get(problem.topic);
                topic.total++;
                topic.total_weight += getWeight(problem.difficulty);

                if (problem.difficulty === 'easy') topic.easy_total++;
                if (problem.difficulty === 'medium') topic.medium_total++;
                if (problem.difficulty === 'hard') topic.hard_total++;
            });

            userStatus?.forEach(status => {
                const topicName = (status.problems as any)?.topic;
                if (!topicName || !topicMap.has(topicName)) return;

                const topic = topicMap.get(topicName);
                topic.solved++;
                topic.solved_weight += getWeight((status.problems as any).difficulty);

                if ((status.problems as any).difficulty === 'easy') topic.easy_solved++;
                if ((status.problems as any).difficulty === 'medium') topic.medium_solved++;
                if ((status.problems as any).difficulty === 'hard') topic.hard_solved++;
            });

            // Calculate progress percentages
            const progress = Array.from(topicMap.values()).map(topic => ({
                ...topic,
                progress: topic.total_weight > 0 ? Math.floor((topic.solved_weight / topic.total_weight) * 100) : 0,
                raw_progress: topic.total > 0 ? Math.floor((topic.solved / topic.total) * 100) : 0,
            }));

            // Sort by progress desc
            progress.sort((a, b) => b.progress - a.progress);

            // Cache for 5 minutes
            await CacheService.set(cacheKey, progress, 300);

            return progress;
        } catch (error) {
            logger.error('Error fetching progress:', { user_id, error });
            throw new Error('Failed to fetch progress');
        }
    }

    /**
     * Update study time
     */
    static async updateStudyTime(user_id: string, seconds: number) {
        try {
            const { data: user } = await supabase
                .from('users')
                .select('study_time_total')
                .eq('id', user_id)
                .single();

            if (!user) throw new Error('User not found');

            const newTotal = (user.study_time_total || 0) + seconds;

            const { error } = await supabase
                .from('users')
                .update({
                    study_time_total: newTotal,
                    last_study_session: new Date().toISOString(),
                })
                .eq('id', user_id);

            if (error) throw error;

            // Invalidate stats cache
            await CacheService.del(`user:${user_id}:stats`);

            return { study_time_total: newTotal };
        } catch (error) {
            logger.error('Error updating study time:', { user_id, error });
            throw new Error('Failed to update study time');
        }
    }

    /**
     * Get activity heatmap (submissions per day)
     */
    static async getActivityHeatmap(user_id: string) {
        const cacheKey = `user:${user_id}:heatmap`;
        const cached = await CacheService.get(cacheKey);
        if (cached) return cached;

        try {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const { data } = await supabase
                .from('user_problem_status')
                .select('solved_at')
                .eq('user_id', user_id)
                .eq('status', 'solved')
                .gte('solved_at', oneYearAgo.toISOString());

            const activityMap = new Map<string, number>();

            data?.forEach(sub => {
                const date = new Date(sub.solved_at).toISOString().split('T')[0];
                activityMap.set(date, (activityMap.get(date) || 0) + 1);
            });

            const heatmap = Array.from(activityMap.entries()).map(([date, count]) => ({
                date,
                count,
                level: count >= 5 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : 1,
            }));

            await CacheService.set(cacheKey, heatmap, 300);
            return heatmap;
        } catch (error) {
            logger.error('Error fetching heatmap:', { user_id, error });
            throw new Error('Failed to fetch activity heatmap');
        }
    }

    /**
     * Get skill radar data
     */
    static async getSkillRadar(user_id: string) {
        // Reuse getProgress logic but format for Radar Chart
        const progress = (await this.getProgress(user_id)) as any[];

        return progress.map((p: any) => ({
            topic: p.topic,
            mastery: p.progress, // 0-100
            fullMark: 100,
        }));
    }

    /**
     * Get weekly progress comparison
     */
    static async getWeeklyProgress(user_id: string) {
        const cacheKey = `user:${user_id}:weekly`;
        const cached = await CacheService.get(cacheKey);
        if (cached) return cached;

        try {
            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            startOfWeek.setHours(0, 0, 0, 0);

            const startOfLastWeek = new Date(startOfWeek);
            startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

            const endOfLastWeek = new Date(startOfWeek);
            endOfLastWeek.setSeconds(endOfLastWeek.getSeconds() - 1);

            const { data: submissions } = await supabase
                .from('submissions')
                .select('submitted_at, solved')
                .eq('user_id', user_id)
                .gte('submitted_at', startOfLastWeek.toISOString());

            let thisWeekSolved = 0;
            let lastWeekSolved = 0;

            submissions?.forEach(sub => {
                if (!sub.solved) return;
                const date = new Date(sub.submitted_at);
                if (date >= startOfWeek) {
                    thisWeekSolved++;
                } else if (date >= startOfLastWeek && date <= endOfLastWeek) {
                    lastWeekSolved++;
                }
            });

            const result = {
                thisWeek: thisWeekSolved,
                lastWeek: lastWeekSolved,
                trend: thisWeekSolved >= lastWeekSolved ? 'up' : 'down',
                percentChange: lastWeekSolved === 0 ? (thisWeekSolved > 0 ? 100 : 0) : Math.round(((thisWeekSolved - lastWeekSolved) / lastWeekSolved) * 100)
            };

            await CacheService.set(cacheKey, result, 300);
            return result;
        } catch (error) {
            logger.error('Error fetching weekly progress:', { user_id, error });
            throw new Error('Failed to fetch weekly progress');
        }
    }
}

