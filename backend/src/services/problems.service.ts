import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

interface GetProblemsParams {
    page: number;
    limit: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    topic?: string;
    search?: string;
    is_premium?: boolean;
    user_id?: string;
}

export class ProblemsService {
    /**
     * Get problems list with filters and pagination
     */
    static async getProblems(params: GetProblemsParams) {
        const { page, limit, difficulty, topic, search, is_premium, user_id } = params;
        const offset = (page - 1) * limit;

        // Generate cache key
        const cacheKey = `problems:${JSON.stringify(params)}`;

        // Try cache first
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            logger.info('Cache hit for problems list');
            return cached;
        }

        try {
            // Build query
            let query = supabase
                .from('problems')
                .select('*, user_problem_status!left(status), user_notes!left(id)', { count: 'exact' });

            // Apply filters
            if (difficulty) {
                query = query.eq('difficulty', difficulty);
            }
            if (topic) {
                query = query.eq('topic', topic);
            }
            if (typeof is_premium === 'boolean') {
                query = query.eq('is_premium', is_premium);
            }
            if (search) {
                query = query.textSearch('search_vector', search);
            }

            // Filter submissions by user
            if (user_id) {
                query = query.eq('user_problem_status.user_id', user_id);
                query = query.eq('user_problem_status.user_id', user_id);
                query = query.eq('user_notes.user_id', user_id);
            }

            // Pagination
            query = query
                .order('order_index', { ascending: true })
                .range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            // Format response
            // Format response
            const problems = data?.map(problem => ({
                id: problem.id,
                slug: problem.slug,
                title: problem.title,
                difficulty: problem.difficulty,
                topic: problem.topic,
                companies: problem.companies,
                is_premium: problem.is_premium,
                solved_count: problem.solved_count,
                acceptance_rate: problem.acceptance_rate,
                // User-specific data from user_problem_status and user_notes
                status: problem.user_problem_status?.[0]?.status || null,
                solved: problem.user_problem_status?.[0]?.status === 'solved',
                tried: problem.user_problem_status?.[0]?.status === 'tried',
                revision: problem.user_problem_status?.[0]?.status === 'revision',
                has_notes: problem.user_notes?.length > 0 || false,
            })) || [];

            const result = {
                problems,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit),
                },
            };

            // Cache for 5 minutes
            await CacheService.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            logger.error('Error fetching problems:', error);
            throw new Error('Failed to fetch problems');
        }
    }

    /**
     * Get single problem by slug
     */
    static async getProblemBySlug(slug: string, user_id?: string) {
        // Try cache first
        const cacheKey = `problem:${slug}:${user_id || 'anon'}`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            logger.info('Cache hit for problem:', slug);
            return cached;
        }

        try {
            let query = supabase
                .from('problems')
                .select('*, user_problem_status!left(status, solved_at), user_notes!left(*)')
                .eq('slug', slug);

            // Filter submissions by user
            if (user_id) {
                query = query.eq('user_problem_status.user_id', user_id);
                query = query.eq('user_notes.user_id', user_id);
            }

            const { data, error } = await query.single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error('Problem not found');
                }
                throw error;
            }

            // Format response
            const problem = {
                id: data.id,
                slug: data.slug,
                title: data.title,
                description: data.description,
                difficulty: data.difficulty,
                topic: data.topic,
                companies: data.companies,
                constraints: data.constraints,
                time_complexity: data.time_complexity,
                space_complexity: data.space_complexity,
                is_premium: data.is_premium,
                required_plan: data.required_plan,
                solved_count: data.solved_count,
                acceptance_rate: data.acceptance_rate,
                // User-specific data
                submission: data.submissions?.[0] || null,
                status: data.user_problem_status?.[0]?.status || null,
                solved: data.user_problem_status?.[0]?.status === 'solved',
                notes: data.user_notes?.[0] || null,
            };

            // Cache for 10 minutes
            await CacheService.set(cacheKey, problem, 600);

            return problem;
        } catch (error) {
            logger.error('Error fetching problem:', { slug, error });
            throw error;
        }
    }

    /**
     * Get problem hints (premium feature)
     */
    static async getHints(problem_id: string, user_plan: string) {
        try {
            const { data, error } = await supabase
                .from('problems')
                .select('hints, required_plan, is_premium')
                .eq('id', problem_id)
                .single();

            if (error) throw error;

            // Check access
            if (data.is_premium && user_plan === 'free') {
                throw new Error('Premium subscription required');
            }

            return { hints: data.hints };
        } catch (error) {
            logger.error('Error fetching hints:', { problem_id, error });
            throw error;
        }
    }

    /**
     * Get problem solution (premium feature)
     */
    static async getSolution(problem_id: string, user_plan: string) {
        try {
            const { data, error } = await supabase
                .from('problems')
                .select('solution_code, solution_explanation, required_plan, is_premium')
                .eq('id', problem_id)
                .single();

            if (error) throw error;

            // Check access
            if (data.is_premium && user_plan === 'free') {
                throw new Error('Premium subscription required');
            }

            return {
                solution_code: data.solution_code,
                solution_explanation: data.solution_explanation,
            };
        } catch (error) {
            logger.error('Error fetching solution:', { problem_id, error });
            throw error;
        }
    }
}
