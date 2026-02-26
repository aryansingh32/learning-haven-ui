import { supabase } from '../config/database';
import logger from '../config/logger';

export async function checkBadges(userId: string): Promise<string | null> {
    try {
        let awarded: string | null = null;

        // First step: completed chapter 1
        const { data: firstChapter } = await supabase
            .from('chapters')
            .select('id, chapter_number')
            .eq('chapter_number', 1)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (firstChapter?.id) {
            const { data: firstProgress } = await supabase
                .from('user_chapter_progress')
                .select('id, status')
                .eq('user_id', userId)
                .eq('chapter_id', firstChapter.id)
                .eq('status', 'COMPLETED')
                .maybeSingle();

            if (firstProgress) {
                await supabase
                    .from('user_badges')
                    .upsert({
                        user_id: userId,
                        badge_id: 'first_step',
                        badge_name: 'First Step',
                        badge_emoji: '⚔️',
                    }, {
                        onConflict: 'user_id,badge_id',
                    });
                awarded = awarded || 'first_step';
            }
        }

        // Week streak: streak_count >= 7
        const { data: streakUser } = await supabase
            .from('users')
            .select('streak')
            .eq('id', userId)
            .maybeSingle();

        if ((streakUser?.streak || 0) >= 7) {
            await supabase
                .from('user_badges')
                .upsert({
                    user_id: userId,
                    badge_id: 'week_streak',
                    badge_name: 'Week Streak',
                    badge_emoji: '🔥',
                }, {
                    onConflict: 'user_id,badge_id',
                });
            awarded = awarded || 'week_streak';
        }

        // Fast learner: completed 5 chapters in last 7 days
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const { data: recentCompleted } = await supabase
            .from('user_chapter_progress')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'COMPLETED')
            .gte('completed_at', sevenDaysAgo.toISOString());

        if ((recentCompleted || []).length >= 5) {
            await supabase
                .from('user_badges')
                .upsert({
                    user_id: userId,
                    badge_id: 'fast_learner',
                    badge_name: 'Fast Learner',
                    badge_emoji: '⚡',
                }, {
                    onConflict: 'user_id,badge_id',
                });
            awarded = awarded || 'fast_learner';
        }

        // DSA champion: completed all 18 chapters
        const { data: completedChapters } = await supabase
            .from('user_chapter_progress')
            .select('chapter_id')
            .eq('user_id', userId)
            .eq('status', 'COMPLETED');

        const completedSet = new Set((completedChapters || []).map(row => row.chapter_id));

        if (completedSet.size >= 18) {
            await supabase
                .from('user_badges')
                .upsert({
                    user_id: userId,
                    badge_id: 'dsa_champion',
                    badge_name: 'DSA Champion',
                    badge_emoji: '🏆',
                }, {
                    onConflict: 'user_id,badge_id',
                });
            awarded = awarded || 'dsa_champion';
        }

        return awarded;
    } catch (error) {
        logger.error('Check badges error:', { userId, error });
        return null;
    }
}

