import { supabase, pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';

export class CoursesService {
    /**
     * List all published courses
     */
    static async listCourses(includeUnpublished: boolean = false) {
        try {
            const cacheKey = `courses:list:${includeUnpublished}`;
            const cached = await CacheService.get<any>(cacheKey);
            if (cached) return cached;

            let queryStr = 'SELECT * FROM public.courses';
            const params: any[] = [];
            
            if (!includeUnpublished) {
                queryStr += ' WHERE is_published = true';
            }
            
            queryStr += ' ORDER BY order_index ASC, created_at DESC';

            const resultRows = await pool.query(queryStr, params);
            const data = resultRows.rows;

            const result = data || [];
            await CacheService.set(cacheKey, result, 300);
            return result;
        } catch (error) {
            logger.error('List courses error:', error);
            throw new Error('Failed to list courses');
        }
    }

    /**
     * Get course with all items
     */
    static async getCourse(idOrSlug: string) {
        try {
            const isUuid = /^[0-9a-f]{8}-/.test(idOrSlug);

            let query = supabase
                .from('courses')
                .select('*, course_items(*, problems(id, title, slug, difficulty, topic, is_premium, solved_count))')
                .single();

            if (isUuid) {
                query = supabase
                    .from('courses')
                    .select('*, course_items(*, problems(id, title, slug, difficulty, topic, is_premium, solved_count))')
                    .eq('id', idOrSlug)
                    .single();
            } else {
                query = supabase
                    .from('courses')
                    .select('*, course_items(*, problems(id, title, slug, difficulty, topic, is_premium, solved_count))')
                    .eq('slug', idOrSlug)
                    .single();
            }

            const { data, error } = await query;
            if (error) throw error;

            // Sort items by order_index
            if (data?.course_items) {
                data.course_items.sort((a: any, b: any) => a.order_index - b.order_index);
            }

            return data;
        } catch (error) {
            logger.error('Get course error:', { idOrSlug, error });
            throw new Error('Failed to get course');
        }
    }

    // ── Admin CRUD ──────────────────────────────────────────

    /**
     * Create course
     */
    static async createCourse(adminId: string, data: {
        title: string;
        description?: string;
        type?: string;
        duration_days?: number;
        difficulty_level?: string;
        cover_image?: string;
        is_premium?: boolean;
        is_published?: boolean;
    }) {
        try {
            const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            if (data.difficulty_level) {
                data.difficulty_level = data.difficulty_level.toLowerCase();
            }
            if (data.type) {
                data.type = data.type.toLowerCase();
            }

            const { data: course, error } = await supabase
                .from('courses')
                .insert({
                    ...data,
                    slug,
                    created_by: adminId,
                })
                .select()
                .single();

            if (error) throw error;
            await CacheService.delPattern('courses:*');
            return course;
        } catch (error) {
            logger.error('Create course error:', error);
            throw new Error('Failed to create course');
        }
    }

    /**
     * Update course
     */
    static async updateCourse(id: string, data: any) {
        try {
            if (data.title) {
                data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }

            if (data.difficulty_level) {
                data.difficulty_level = data.difficulty_level.toLowerCase();
            }
            if (data.type) {
                data.type = data.type.toLowerCase();
            }
            
            // Remove any relationships or extra UI fields
            const payload = { ...data };
            delete payload.items;
            delete payload.course_items;

            const { data: course, error } = await supabase
                .from('courses')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            await CacheService.delPattern('courses:*');
            return course;
        } catch (error) {
            logger.error('Update course error:', { id, error });
            throw new Error('Failed to update course');
        }
    }

    /**
     * Delete course
     */
    static async deleteCourse(id: string) {
        try {
            const { error } = await supabase.from('courses').delete().eq('id', id);
            if (error) throw error;
            await CacheService.delPattern('courses:*');
            return { message: 'Course deleted' };
        } catch (error) {
            logger.error('Delete course error:', { id, error });
            throw new Error('Failed to delete course');
        }
    }

    /**
     * Add item to course
     */
    static async addCourseItem(courseId: string, data: {
        problem_id?: string;
        day_number: number;
        title: string;
        description?: string;
        section?: string;
        order_index?: number;
        is_milestone?: boolean;
    }) {
        try {
            // Get next order_index if not provided
            if (data.order_index === undefined) {
                const { data: maxItem } = await supabase
                    .from('course_items')
                    .select('order_index')
                    .eq('course_id', courseId)
                    .order('order_index', { ascending: false })
                    .limit(1)
                    .single();

                data.order_index = (maxItem?.order_index || 0) + 1;
            }

            const { data: item, error } = await supabase
                .from('course_items')
                .insert({ ...data, course_id: courseId })
                .select('*, problems(id, title, slug, difficulty)')
                .single();

            if (error) throw error;

            // Update item count — RPC may not exist, so just log and continue
            try {
                const { count: itemCount } = await supabase
                    .from('course_items')
                    .select('id', { count: 'exact', head: true })
                    .eq('course_id', courseId);

                await supabase
                    .from('courses')
                    .update({ item_count: itemCount || 0 })
                    .eq('id', courseId);
            } catch (_) {
                // ignore item count update errors
            }

            await CacheService.delPattern('courses:*');
            return item;
        } catch (error) {
            logger.error('Add course item error:', { courseId, error });
            throw new Error('Failed to add course item');
        }
    }

    /**
     * Remove item from course
     */
    static async removeCourseItem(courseId: string, itemId: string) {
        try {
            const { error } = await supabase
                .from('course_items')
                .delete()
                .eq('id', itemId)
                .eq('course_id', courseId);

            if (error) throw error;
            await CacheService.delPattern('courses:*');
            return { message: 'Item removed' };
        } catch (error) {
            logger.error('Remove course item error:', { courseId, itemId, error });
            throw new Error('Failed to remove course item');
        }
    }

    /**
     * Reorder course items
     */
    static async reorderItems(courseId: string, items: { id: string; order_index: number }[]) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                await client.query(
                    'UPDATE course_items SET order_index = $1 WHERE id = $2 AND course_id = $3',
                    [item.order_index, item.id, courseId]
                );
            }
            await client.query('COMMIT');
            await CacheService.delPattern('courses:*');
            return { message: 'Items reordered' };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Reorder course items error:', error);
            throw new Error('Failed to reorder course items');
        } finally {
            client.release();
        }
    }

    /**
     * Reorder courses
     */
    static async reorderCourses(courses: { id: string; order_index: number }[]) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const course of courses) {
                await client.query(
                    'UPDATE courses SET order_index = $1 WHERE id = $2',
                    [course.order_index, course.id]
                );
            }
            await client.query('COMMIT');
            await CacheService.delPattern('courses:*');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Reorder courses error:', error);
            throw new Error('Failed to reorder courses');
        } finally {
            client.release();
        }
    }
}
