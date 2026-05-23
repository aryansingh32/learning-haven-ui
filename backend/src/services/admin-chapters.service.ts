import { supabase, pool } from '../config/database';
import logger from '../config/logger';
import { CacheService } from './cache.service';

export class AdminChaptersService {
    static async listByRoadmap(roadmapId: string) {
        const chaptersResult = await pool.query(
            `SELECT c.*,
              (SELECT COUNT(*)::int FROM public.steps s WHERE s.chapter_id = c.id) AS step_count
             FROM public.chapters c
             WHERE c.roadmap_id = $1
             ORDER BY c.chapter_number ASC`,
            [roadmapId]
        );
        return chaptersResult.rows;
    }

    static async getById(chapterId: string) {
        const chapterResult = await pool.query(
            'SELECT * FROM public.chapters WHERE id = $1',
            [chapterId]
        );
        const chapter = chapterResult.rows[0];
        if (!chapter) throw new Error('Chapter not found');

        const contentResult = await pool.query(
            'SELECT * FROM public.chapter_content WHERE chapter_id = $1',
            [chapterId]
        );
        const stepsResult = await pool.query(
            'SELECT * FROM public.steps WHERE chapter_id = $1 ORDER BY step_number ASC',
            [chapterId]
        );

        return {
            chapter,
            content: contentResult.rows[0] || null,
            steps: stepsResult.rows,
        };
    }

    static async create(data: {
        roadmap_id: string;
        chapter_number: number;
        title: string;
        topic_tag?: string;
        difficulty?: string;
        est_minutes?: number;
        story_hook?: string;
        whatsapp_msg?: string;
    }) {
        const { data: inserted, error } = await supabase
            .from('chapters')
            .insert(data)
            .select('*')
            .single();

        if (error) throw error;
        await CacheService.del(`roadmaps:list:true`);
        await CacheService.del(`roadmaps:list:false`);
        return inserted;
    }

    static async update(chapterId: string, data: Record<string, unknown>) {
        const allowed = [
            'chapter_number', 'title', 'topic_tag', 'difficulty',
            'est_minutes', 'story_hook', 'whatsapp_msg', 'is_active',
        ];
        const payload: Record<string, unknown> = {};
        for (const key of allowed) {
            if (key in data) payload[key] = data[key];
        }

        const { data: updated, error } = await supabase
            .from('chapters')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', chapterId)
            .select('*')
            .single();

        if (error) throw error;
        return updated;
    }

    static async delete(chapterId: string) {
        await pool.query('DELETE FROM public.steps WHERE chapter_id = $1', [chapterId]);
        await pool.query('DELETE FROM public.chapter_content WHERE chapter_id = $1', [chapterId]);
        const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
        if (error) throw error;
        return { success: true };
    }

    static async upsertContent(chapterId: string, content: Record<string, unknown>) {
        const { data, error } = await supabase
            .from('chapter_content')
            .upsert({ chapter_id: chapterId, ...content }, { onConflict: 'chapter_id' })
            .select('*')
            .single();
        if (error) throw error;
        return data;
    }

    static async replaceSteps(chapterId: string, steps: Array<{
        step_number: number;
        type: string;
        title: string;
        content: Record<string, unknown>;
    }>) {
        await pool.query('DELETE FROM public.steps WHERE chapter_id = $1', [chapterId]);
        if (steps.length === 0) return [];

        const { data, error } = await supabase.from('steps').insert(
            steps.map((s) => ({ ...s, chapter_id: chapterId }))
        ).select('*');

        if (error) throw error;
        return data;
    }

    static async adminUnlockForUser(userId: string, chapterId: string, status: 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'COMPLETED') {
        const now = new Date().toISOString();
        const payload: Record<string, unknown> = {
            user_id: userId,
            chapter_id: chapterId,
            status,
            updated_at: now,
        };
        if (status === 'UNLOCKED') payload.unlocked_at = now;
        if (status === 'COMPLETED') payload.completed_at = now;

        const { data, error } = await supabase
            .from('user_chapter_progress')
            .upsert(payload, { onConflict: 'user_id,chapter_id' })
            .select('*')
            .single();

        if (error) throw error;
        return data;
    }
}
