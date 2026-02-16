import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

export class CategoriesService {
    /**
     * List all categories with pattern count
     */
    static async listCategories() {
        try {
            const cached = await CacheService.get<any>('categories:all');
            if (cached) return cached;

            const { data, error } = await supabase
                .from('categories')
                .select('*, patterns(id, name, slug, problem_count)')
                .eq('is_active', true)
                .order('order_index', { ascending: true });

            if (error) throw error;

            const result = data || [];
            await CacheService.set('categories:all', result, 600);
            return result;
        } catch (error) {
            logger.error('List categories error:', error);
            throw new Error('Failed to list categories');
        }
    }

    /**
     * Get single category with patterns and problems
     */
    static async getCategory(idOrSlug: string) {
        try {
            const isUuid = /^[0-9a-f]{8}-/.test(idOrSlug);
            let query = supabase
                .from('categories')
                .select('*, patterns(*, problem_patterns(problem_id, problems(id, title, slug, difficulty, solved_count)))')
                .single();

            if (isUuid) {
                query = supabase
                    .from('categories')
                    .select('*, patterns(*, problem_patterns(problem_id, problems(id, title, slug, difficulty, solved_count)))')
                    .eq('id', idOrSlug)
                    .single();
            } else {
                query = supabase
                    .from('categories')
                    .select('*, patterns(*, problem_patterns(problem_id, problems(id, title, slug, difficulty, solved_count)))')
                    .eq('slug', idOrSlug)
                    .single();
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Get category error:', { idOrSlug, error });
            throw new Error('Failed to get category');
        }
    }

    /**
     * List patterns, optionally filtered by category
     */
    static async listPatterns(categoryId?: string) {
        try {
            let query = supabase
                .from('patterns')
                .select('*, categories(name, slug)')
                .eq('is_active', true)
                .order('order_index', { ascending: true });

            if (categoryId) {
                query = query.eq('category_id', categoryId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('List patterns error:', error);
            throw new Error('Failed to list patterns');
        }
    }

    // ── Admin CRUD ──────────────────────────────────────────

    /**
     * Create category
     */
    static async createCategory(data: {
        name: string;
        description?: string;
        icon?: string;
        color?: string;
        order_index?: number;
    }) {
        try {
            const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            const { data: category, error } = await supabase
                .from('categories')
                .insert({ ...data, slug })
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('categories:*');
            return category;
        } catch (error) {
            logger.error('Create category error:', error);
            throw new Error('Failed to create category');
        }
    }

    /**
     * Update category
     */
    static async updateCategory(id: string, data: any) {
        try {
            if (data.name) {
                data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }

            const { data: category, error } = await supabase
                .from('categories')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('categories:*');
            return category;
        } catch (error) {
            logger.error('Update category error:', { id, error });
            throw new Error('Failed to update category');
        }
    }

    /**
     * Delete category
     */
    static async deleteCategory(id: string) {
        try {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
            await CacheService.del('categories:*');
            return { message: 'Category deleted' };
        } catch (error) {
            logger.error('Delete category error:', { id, error });
            throw new Error('Failed to delete category');
        }
    }

    /**
     * Create pattern
     */
    static async createPattern(data: {
        category_id: string;
        name: string;
        description?: string;
        order_index?: number;
    }) {
        try {
            const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            const { data: pattern, error } = await supabase
                .from('patterns')
                .insert({ ...data, slug })
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('categories:*');
            return pattern;
        } catch (error) {
            logger.error('Create pattern error:', error);
            throw new Error('Failed to create pattern');
        }
    }

    /**
     * Update pattern
     */
    static async updatePattern(id: string, data: any) {
        try {
            if (data.name) {
                data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }

            const { data: pattern, error } = await supabase
                .from('patterns')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('categories:*');
            return pattern;
        } catch (error) {
            logger.error('Update pattern error:', { id, error });
            throw new Error('Failed to update pattern');
        }
    }

    /**
     * Delete pattern
     */
    static async deletePattern(id: string) {
        try {
            const { error } = await supabase.from('patterns').delete().eq('id', id);
            if (error) throw error;
            await CacheService.del('categories:*');
            return { message: 'Pattern deleted' };
        } catch (error) {
            logger.error('Delete pattern error:', { id, error });
            throw new Error('Failed to delete pattern');
        }
    }

    /**
     * Link problem to pattern
     */
    static async linkProblemToPattern(problemId: string, patternId: string, isPrimary: boolean = false) {
        try {
            const { data, error } = await supabase
                .from('problem_patterns')
                .upsert({ problem_id: problemId, pattern_id: patternId, is_primary: isPrimary })
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('categories:*');
            return data;
        } catch (error) {
            logger.error('Link problem error:', { problemId, patternId, error });
            throw new Error('Failed to link problem to pattern');
        }
    }

    /**
     * Unlink problem from pattern
     */
    static async unlinkProblemFromPattern(problemId: string, patternId: string) {
        try {
            const { error } = await supabase
                .from('problem_patterns')
                .delete()
                .eq('problem_id', problemId)
                .eq('pattern_id', patternId);

            if (error) throw error;
            await CacheService.del('categories:*');
            return { message: 'Problem unlinked from pattern' };
        } catch (error) {
            logger.error('Unlink problem error:', { problemId, patternId, error });
            throw new Error('Failed to unlink problem');
        }
    }

    /**
     * Bulk import problems from CSV/JSON (Google Sheets export)
     */
    static async importProblems(adminId: string, problems: Array<{
        title: string;
        description: string;
        difficulty: string;
        category?: string;
        pattern?: string;
        companies?: string[];
        hints?: string[];
        is_premium?: boolean;
        time_complexity?: string;
        space_complexity?: string;
    }>) {
        try {
            const results = { imported: 0, skipped: 0, errors: [] as string[] };

            for (const p of problems) {
                try {
                    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                    // Get max order_index
                    const { data: maxOrder } = await supabase
                        .from('problems')
                        .select('order_index')
                        .order('order_index', { ascending: false })
                        .limit(1)
                        .single();

                    const nextOrder = (maxOrder?.order_index || 0) + 1;

                    const { data: problem, error } = await supabase
                        .from('problems')
                        .upsert({
                            slug,
                            title: p.title,
                            description: p.description,
                            difficulty: p.difficulty,
                            topic: p.category || p.pattern || 'Uncategorized',
                            companies: p.companies || [],
                            hints: p.hints || [],
                            is_premium: p.is_premium || false,
                            time_complexity: p.time_complexity || '',
                            space_complexity: p.space_complexity || '',
                            order_index: nextOrder,
                        }, { onConflict: 'slug' })
                        .select()
                        .single();

                    if (error) {
                        results.errors.push(`${p.title}: ${error.message}`);
                        results.skipped++;
                        continue;
                    }

                    // Link to pattern if specified
                    if (p.pattern && problem) {
                        const { data: pattern } = await supabase
                            .from('patterns')
                            .select('id')
                            .eq('name', p.pattern)
                            .single();

                        if (pattern) {
                            await supabase.from('problem_patterns')
                                .upsert({ problem_id: problem.id, pattern_id: pattern.id })
                                .select();
                        }
                    }

                    results.imported++;
                } catch (err: any) {
                    results.errors.push(`${p.title}: ${err.message}`);
                    results.skipped++;
                }
            }

            await CacheService.del('problems:*');
            await CacheService.del('categories:*');

            return results;
        } catch (error) {
            logger.error('Import problems error:', error);
            throw new Error('Failed to import problems');
        }
    }
}
