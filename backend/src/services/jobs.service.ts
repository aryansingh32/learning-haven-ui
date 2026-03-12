import { supabase } from '../config/database';
import logger from '../config/logger';

export interface JobFilter {
    type?: string;
    page?: number;
    limit?: number;
}

export class JobsService {
    static async listJobs(filter: JobFilter) {
        const { type, page = 1, limit = 20 } = filter;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('job_alerts')
            .select('*', { count: 'exact' })
            .eq('is_active', true);

        if (type) {
            query = query.eq('type', type);
        }

        query = query.order('posted_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            logger.error('Error fetching jobs:', error);
            throw error;
        }

        return {
            jobs: data || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                total_pages: Math.ceil((count || 0) / limit),
            }
        };
    }

    static async getLatestJobs(limit = 3) {
        const { data, error } = await supabase
            .from('job_alerts')
            .select('*')
            .eq('is_active', true)
            .order('posted_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('Error fetching latest jobs:', error);
            throw error;
        }

        return data || [];
    }

    static async createJob(jobData: any) {
        // Validate URL
        if (jobData.apply_url) {
            try {
                new URL(jobData.apply_url);
            } catch (e) {
                throw new Error('Invalid apply_url format');
            }
        }

        const { data, error } = await supabase
            .from('job_alerts')
            .insert({
                ...jobData,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            logger.error('Error creating job:', error);
            throw error;
        }

        return data;
    }

    static async updateJob(id: string, updates: any) {
        if (updates.apply_url) {
            try {
                new URL(updates.apply_url);
            } catch (e) {
                throw new Error('Invalid apply_url format');
            }
        }

        const { data, error } = await supabase
            .from('job_alerts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Error updating job:', error);
            throw error;
        }

        return data;
    }
}
