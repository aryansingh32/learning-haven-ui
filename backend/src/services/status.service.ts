import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

export class StatusService {
    /**
     * Update problem status
     */
    static async updateStatus(user_id: string, problem_id: string, status: 'solved' | 'tried' | 'revision') {
        try {
            const now = new Date().toISOString();

            const { data, error } = await supabase
                .from('user_problem_status')
                .upsert({
                    user_id,
                    problem_id,
                    status,
                    solved_at: status === 'solved' ? now : null,
                    updated_at: now
                }, { onConflict: 'user_id, problem_id' })
                .select()
                .single();

            if (error) throw error;

            // Invalidate caches
            await CacheService.del(`user:${user_id}:stats`);
            await CacheService.del(`user:${user_id}:progress`);

            return data;
        } catch (error) {
            logger.error('Error updating status:', { user_id, problem_id, status, error });
            throw new Error('Failed to update status');
        }
    }

    /**
     * Get user status for a problem
     */
    static async getStatus(user_id: string, problem_id: string) {
        try {
            const { data, error } = await supabase
                .from('user_problem_status')
                .select('*')
                .eq('user_id', user_id)
                .eq('problem_id', problem_id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data || null;
        } catch (error) {
            logger.error('Error fetching status:', { user_id, problem_id, error });
            throw new Error('Failed to fetch status');
        }
    }
}
