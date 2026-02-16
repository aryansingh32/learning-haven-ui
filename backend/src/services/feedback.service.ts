import { supabase } from '../config/database';
import logger from '../config/logger';

export class FeedbackService {
    /**
     * Submit feedback
     */
    static async submitFeedback(userId: string, data: {
        type?: string;
        subject: string;
        message: string;
        rating?: number;
    }) {
        try {
            const { data: feedback, error } = await supabase
                .from('feedback')
                .insert({
                    user_id: userId,
                    type: data.type || 'general',
                    subject: data.subject,
                    message: data.message,
                    rating: data.rating || null,
                })
                .select()
                .single();

            if (error) throw error;
            return feedback;
        } catch (error) {
            logger.error('Submit feedback error:', { userId, error });
            throw new Error('Failed to submit feedback');
        }
    }

    /**
     * Get user's own feedback
     */
    static async getUserFeedback(userId: string) {
        try {
            const { data, error } = await supabase
                .from('feedback')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Get user feedback error:', { userId, error });
            throw new Error('Failed to get feedback');
        }
    }

    /**
     * Admin: List all feedback with filters
     */
    static async listAllFeedback(filters: {
        status?: string;
        type?: string;
        page?: number;
        limit?: number;
    } = {}) {
        try {
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('feedback')
                .select('*, users(email, full_name)', { count: 'exact' });

            if (filters.status) query = query.eq('status', filters.status);
            if (filters.type) query = query.eq('type', filters.type);

            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            return {
                feedback: data || [],
                pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
            };
        } catch (error) {
            logger.error('List all feedback error:', error);
            throw new Error('Failed to list feedback');
        }
    }

    /**
     * Admin: Update feedback status/notes
     */
    static async updateFeedback(id: string, data: { status?: string; admin_notes?: string }) {
        try {
            const { data: feedback, error } = await supabase
                .from('feedback')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return feedback;
        } catch (error) {
            logger.error('Update feedback error:', { id, error });
            throw new Error('Failed to update feedback');
        }
    }
}
