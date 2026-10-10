import { pool, supabase } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';
import { indiaDate, pickDaily } from './practiceHelpers';

interface GetProblemsParams {
    page: number;
    limit: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    topic?: string;
    search?: string;
    company?: string;
    is_premium?: boolean;
    user_id?: string;
    /** A college's own problems (only for its members); otherwise Forge's public library. */
    college_id?: string;
}

export const FORGE_ORG = '00000000-0000-0000-0000-00000000f0f0';

export class ProblemsService {
    /**
     * Who may open a problem: Forge's public library is for everyone; a college's
     * problems only for that college's active members (and its content staff, even
     * as drafts). Same rule as the database's campus.user_can_see_content.
     */
    static async canSee(problem: { owner_org_id?: string | null; visibility?: string | null }, userId?: string): Promise<boolean> {
        const owner = problem.owner_org_id ?? FORGE_ORG;
        const visibility = problem.visibility ?? 'public';
        if (owner === FORGE_ORG && visibility === 'public') return true;
        if (!userId) return false;
        try {
            const { rows } = await pool.query<{ ok: boolean }>(
                `select campus.user_can_see_content($1, $2, $3::public.content_visibility, true) as ok`, [userId, owner, visibility]);
            return Boolean(rows[0]?.ok);
        } catch (error: any) {
            // Before the college-content migration there is no college content to see.
            if (error?.code === '42883' || error?.code === '42703') return false;
            throw error;
        }
    }

    /** The colleges a learner belongs to (for "From your college" sections). */
    static async userColleges(userId?: string): Promise<{ org_id: string; name: string; slug: string; logo_url: string | null; brand_color: string | null }[]> {
        if (!userId) return [];
        try {
            return (await pool.query(`select * from campus.user_colleges($1)`, [userId])).rows;
        } catch (error: any) {
            if (error?.code === '42883' || error?.code === '3F000') return [];
            throw error;
        }
    }

    /**
     * Get problems list with filters and pagination
     */
    static async getProblems(params: GetProblemsParams) {
        const { page, limit, difficulty, topic, search, company, is_premium, user_id, college_id } = params;
        if (college_id && !(await ProblemsService.userColleges(user_id)).some((c) => c.org_id === college_id)) {
            return { problems: [], pagination: { page, limit, total: 0, total_pages: 0 } };
        }
        const offset = (page - 1) * limit;

        // Generate cache key
        const cacheKey = `problems:${JSON.stringify(params)}`;

        // Try cache first. A college's own list isn't cached: it is small, and its staff
        // publish and remove problems from the Campus API, which can't clear this cache.
        const cached = college_id ? null : await CacheService.get(cacheKey);
        if (cached) {
            logger.info('Cache hit for problems list');
            return cached;
        }

        try {
            // Build query
            let query = supabase
                .from('problems')
                .select('*, user_problem_status!left(status), user_notes!left(id)', { count: 'exact' })
                .is('deleted_at', null)
                .eq('owner_org_id', college_id ?? FORGE_ORG)
                .eq('visibility', college_id ? 'org' : 'public');

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
            if (company) {
                query = query.contains('companies', [company]);
            }
            if (search) {
                // Already cleaned of wildcards and PostgREST syntax (cleanSearch).
                query = query.ilike('title', `%${search}%`);
            }

            // Filter submissions by user
            if (user_id) {
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
            if (!college_id) await CacheService.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            logger.error('Error fetching problems:', error);
            throw new Error('Failed to fetch problems');
        }
    }

    /** Every company that has asked a live problem, most problems first (for the company filter). */
    static async getCompanies() {
        const cacheKey = 'problems:companies';
        const cached = await CacheService.get(cacheKey);
        if (cached) return cached;
        const { data, error } = await supabase.from('problems').select('companies').is('deleted_at', null)
            .eq('owner_org_id', FORGE_ORG).eq('visibility', 'public');
        if (error) throw error;
        const counts = new Map<string, number>();
        for (const row of data ?? []) for (const c of (row.companies as string[] | null) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
        const result = {
            companies: [...counts.entries()]
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        };
        await CacheService.set(cacheKey, result, 300);
        return result;
    }

    /**
     * Today's problem: the same free problem for everyone, turning over at midnight in India.
     * With a signed-in learner, also whether they've solved it (ever, and today).
     */
    static async getDaily(user_id?: string, now: Date = new Date()) {
        const date = indiaDate(now);
        const { data, error } = await supabase
            .from('problems')
            .select('id, slug, title, difficulty, topic, companies')
            .is('deleted_at', null)
            .eq('owner_org_id', FORGE_ORG)
            .eq('visibility', 'public')
            .eq('is_premium', false);
        if (error) throw error;
        const problem = pickDaily(data ?? [], date);
        if (!problem) return { date, problem: null, solved: false, solved_today: false };
        let solved = false;
        let solved_today = false;
        if (user_id) {
            const { data: status } = await supabase
                .from('user_problem_status')
                .select('status, solved_at')
                .eq('user_id', user_id)
                .eq('problem_id', problem.id)
                .maybeSingle();
            solved = status?.status === 'solved';
            solved_today = solved && !!status?.solved_at && indiaDate(new Date(status.solved_at)) === date;
        }
        return { date, problem, solved, solved_today };
    }

    /**
     * Get single problem by slug
     */
    static async getProblemBySlug(slug: string, user_id?: string) {
        // Try cache first
        const cacheKey = `problem:${slug}:${user_id || 'anon'}`;
        const cached = await CacheService.get<any>(cacheKey);
        if (cached) {
            // Access can change (left the college, college suspended): check it every time.
            if (!(await ProblemsService.canSee(cached, user_id))) throw new Error('Problem not found');
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
            if (data.deleted_at || !(await ProblemsService.canSee(data, user_id))) throw new Error('Problem not found');

            // Format response
            const problem = {
                id: data.id,
                owner_org_id: data.owner_org_id ?? FORGE_ORG,
                visibility: data.visibility ?? 'public',
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
                // In-app practice: only sample tests leave the server.
                starter_code: data.starter_code || {},
                compare: data.judge_config?.compare || 'exact',
                hint_count: Array.isArray(data.hints) ? data.hints.length : 0,
                ...(await ProblemsService.getSampleTests(data.id)),
            };

            // Cache for 10 minutes
            // College problems are edited and removed from the Campus API, which can't clear this cache.
            if (problem.owner_org_id === FORGE_ORG) await CacheService.set(cacheKey, problem, 600);

            return problem;
        } catch (error) {
            logger.error('Error fetching problem:', { slug, error });
            throw error;
        }
    }

    /** Sample tests for the problem page, and whether the problem can be judged at all. */
    static async getSampleTests(problem_id: string) {
        const { data, error } = await supabase
            .from('problem_test_cases')
            .select('input, expected_output, is_sample, explanation, sort_order')
            .eq('problem_id', problem_id)
            .order('sort_order');
        if (error) {
            // e.g. deployed before the problem_judging migration: the page still works, just without the judge.
            logger.warn('Sample tests unavailable', { problem_id, error: error.message });
            return { judged: false, test_count: 0, sample_tests: [] };
        }
        const rows = data ?? [];
        return {
            judged: rows.length > 0,
            test_count: rows.length,
            sample_tests: rows.filter((r) => r.is_sample).map((r) => ({
                input: r.input, output: r.expected_output, explanation: r.explanation,
            })),
        };
    }

    /** Everything the judge needs, hidden tests included. Server use only. */
    static async getJudgeData(problem_id: string, user_id?: string) {
        const { data: problem, error } = await supabase
            .from('problems')
            .select('id, slug, is_premium, starter_code, judge_config, owner_org_id, visibility')
            .eq('id', problem_id)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw error;
        if (!problem || !(await ProblemsService.canSee(problem, user_id))) return null;
        const { data: tests, error: testsError } = await supabase
            .from('problem_test_cases')
            .select('input, expected_output, is_sample')
            .eq('problem_id', problem_id)
            .order('sort_order');
        if (testsError) throw testsError;
        return { problem, tests: tests ?? [] };
    }

    /** Drop the cached problem pages for this user so status/solve shows immediately. */
    static async invalidateProblemCache(slug: string, user_id: string) {
        await CacheService.del(`problem:${slug}:${user_id}`);
        await CacheService.delPattern(`problems:*`);
    }

    /**
     * Get problem hints (premium feature)
     */
    static async getHints(problem_id: string, user_plan: string, user_id?: string) {
        try {
            const { data, error } = await supabase
                .from('problems')
                .select('hints, required_plan, is_premium, owner_org_id, visibility')
                .eq('id', problem_id)
                .single();

            if (error) throw error;
            if (!(await ProblemsService.canSee(data, user_id))) throw new Error('Problem not found');

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
    static async getSolution(problem_id: string, user_plan: string, user_id?: string) {
        try {
            const { data, error } = await supabase
                .from('problems')
                .select('solution_code, solution_explanation, required_plan, is_premium, owner_org_id, visibility')
                .eq('id', problem_id)
                .single();

            if (error) throw error;
            if (!(await ProblemsService.canSee(data, user_id))) throw new Error('Problem not found');

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
