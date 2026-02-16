import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

export class RoadmapsService {
    /**
     * List all published roadmaps
     */
    static async listRoadmaps(includeUnpublished: boolean = false) {
        try {
            const cacheKey = `roadmaps:list:${includeUnpublished}`;
            const cached = await CacheService.get<any>(cacheKey);
            if (cached) return cached;

            let query = supabase
                .from('roadmaps')
                .select('*')
                .order('created_at', { ascending: false });

            if (!includeUnpublished) {
                query = query.eq('is_published', true);
            }

            const { data, error } = await query;
            if (error) throw error;

            const result = data || [];
            await CacheService.set(cacheKey, result, 300);
            return result;
        } catch (error) {
            logger.error('List roadmaps error:', error);
            throw new Error('Failed to list roadmaps');
        }
    }

    /**
     * Get roadmap with all items
     */
    static async getRoadmap(idOrSlug: string) {
        try {
            const isUuid = /^[0-9a-f]{8}-/.test(idOrSlug);

            let query = supabase
                .from('roadmaps')
                .select('*, roadmap_items(*, problems(id, title, slug, difficulty, topic, is_premium, solved_count))')
                .single();

            if (isUuid) {
                query = supabase
                    .from('roadmaps')
                    .select('*, roadmap_items(*, problems(id, title, slug, difficulty, topic, is_premium, solved_count))')
                    .eq('id', idOrSlug)
                    .single();
            } else {
                query = supabase
                    .from('roadmaps')
                    .select('*, roadmap_items(*, problems(id, title, slug, difficulty, topic, is_premium, solved_count))')
                    .eq('slug', idOrSlug)
                    .single();
            }

            const { data, error } = await query;
            if (error) throw error;

            // Sort items by order_index
            if (data?.roadmap_items) {
                data.roadmap_items.sort((a: any, b: any) => a.order_index - b.order_index);
            }

            return data;
        } catch (error) {
            logger.error('Get roadmap error:', { idOrSlug, error });
            throw new Error('Failed to get roadmap');
        }
    }

    // ── Admin CRUD ──────────────────────────────────────────

    /**
     * Create roadmap
     */
    static async createRoadmap(adminId: string, data: {
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

            const { data: roadmap, error } = await supabase
                .from('roadmaps')
                .insert({
                    ...data,
                    slug,
                    created_by: adminId,
                })
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('roadmaps:*');
            return roadmap;
        } catch (error) {
            logger.error('Create roadmap error:', error);
            throw new Error('Failed to create roadmap');
        }
    }

    /**
     * Update roadmap
     */
    static async updateRoadmap(id: string, data: any) {
        try {
            if (data.title) {
                data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }

            const { data: roadmap, error } = await supabase
                .from('roadmaps')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            await CacheService.del('roadmaps:*');
            return roadmap;
        } catch (error) {
            logger.error('Update roadmap error:', { id, error });
            throw new Error('Failed to update roadmap');
        }
    }

    /**
     * Delete roadmap
     */
    static async deleteRoadmap(id: string) {
        try {
            const { error } = await supabase.from('roadmaps').delete().eq('id', id);
            if (error) throw error;
            await CacheService.del('roadmaps:*');
            return { message: 'Roadmap deleted' };
        } catch (error) {
            logger.error('Delete roadmap error:', { id, error });
            throw new Error('Failed to delete roadmap');
        }
    }

    /**
     * Add item to roadmap
     */
    static async addRoadmapItem(roadmapId: string, data: {
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
                    .from('roadmap_items')
                    .select('order_index')
                    .eq('roadmap_id', roadmapId)
                    .order('order_index', { ascending: false })
                    .limit(1)
                    .single();

                data.order_index = (maxItem?.order_index || 0) + 1;
            }

            const { data: item, error } = await supabase
                .from('roadmap_items')
                .insert({ ...data, roadmap_id: roadmapId })
                .select('*, problems(id, title, slug, difficulty)')
                .single();

            if (error) throw error;

            // Update item count — RPC may not exist, so just log and continue
            try {
                const { count: itemCount } = await supabase
                    .from('roadmap_items')
                    .select('id', { count: 'exact', head: true })
                    .eq('roadmap_id', roadmapId);

                await supabase
                    .from('roadmaps')
                    .update({ item_count: itemCount || 0 })
                    .eq('id', roadmapId);
            } catch (_) {
                // ignore item count update errors
            }

            await CacheService.del('roadmaps:*');
            return item;
        } catch (error) {
            logger.error('Add roadmap item error:', { roadmapId, error });
            throw new Error('Failed to add roadmap item');
        }
    }

    /**
     * Remove item from roadmap
     */
    static async removeRoadmapItem(roadmapId: string, itemId: string) {
        try {
            const { error } = await supabase
                .from('roadmap_items')
                .delete()
                .eq('id', itemId)
                .eq('roadmap_id', roadmapId);

            if (error) throw error;
            await CacheService.del('roadmaps:*');
            return { message: 'Item removed' };
        } catch (error) {
            logger.error('Remove roadmap item error:', { roadmapId, itemId, error });
            throw new Error('Failed to remove roadmap item');
        }
    }

    /**
     * Reorder roadmap items
     */
    static async reorderItems(roadmapId: string, itemOrders: Array<{ id: string; order_index: number }>) {
        try {
            for (const item of itemOrders) {
                await supabase
                    .from('roadmap_items')
                    .update({ order_index: item.order_index })
                    .eq('id', item.id)
                    .eq('roadmap_id', roadmapId);
            }

            await CacheService.del('roadmaps:*');
            return { message: 'Items reordered' };
        } catch (error) {
            logger.error('Reorder items error:', { roadmapId, error });
            throw new Error('Failed to reorder items');
        }
    }
}
