/**
 * Admin: a course's learning rules (prerequisites, drip release) and course
 * export to the CSV files the staged content import reads back
 * (chapters_meta + chapter_steps).
 */
import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import { isMissingObject } from '../../learning/services/learningGate.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PREREQUISITES = 10;

export type ExportType = 'chapters_meta' | 'chapter_steps';
export const EXPORT_TYPES: ExportType[] = ['chapters_meta', 'chapter_steps'];

export interface LearningSettingsInput {
    drip_interval_days: number | null;
    prerequisite_ids: string[];
}

/** Validate the admin form. Returns clean input or an error message. */
export function parseLearningSettings(body: unknown, courseId: string): LearningSettingsInput | string {
    const b = (body ?? {}) as Record<string, unknown>;
    let drip: number | null = null;
    if (b.drip_interval_days !== null && b.drip_interval_days !== undefined && b.drip_interval_days !== '') {
        drip = Number(b.drip_interval_days);
        if (!Number.isInteger(drip) || drip < 1 || drip > 365) return 'Drip interval must be a whole number of days from 1 to 365 (or empty for no drip)';
    }
    const ids = b.prerequisite_ids ?? [];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !UUID.test(id))) return 'prerequisite_ids must be a list of course ids';
    const unique = [...new Set(ids as string[])];
    if (unique.includes(courseId)) return 'A course cannot require itself';
    if (unique.length > MAX_PREREQUISITES) return `A course can have at most ${MAX_PREREQUISITES} prerequisites`;
    return { drip_interval_days: drip, prerequisite_ids: unique };
}

// ── CSV export ──────────────────────────────────────────────────────────────

/**
 * One CSV cell for the import's parser (csv.util parseCsv): it reads line by
 * line and trims cells, so newlines become spaces (JSON keeps them escaped)
 * and cells with commas or quotes are quoted.
 */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/\r?\n/g, ' ').trim();
    return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvLine = (cells: unknown[]) => cells.map(csvCell).join(',');

export interface ExportChapter {
    chapter_number: number;
    title: string;
    topic_tag: string | null;
    difficulty: string | null;
    est_minutes: number | null;
    story_hook: string | null;
    whatsapp_msg: string | null;
}

export interface ExportStep {
    chapter_number: number;
    step_number: number;
    type: string;
    title: string;
    content: Record<string, unknown> | null;
}

export const CHAPTERS_META_HEADERS = ['roadmap_slug', 'chapter_number', 'title', 'topic_tag', 'difficulty', 'est_minutes', 'story_hook', 'whatsapp_msg'];
export const CHAPTER_STEPS_HEADERS = ['roadmap_slug', 'chapter_number', 'step_number', 'step_type', 'step_title', 'step_content_json'];

export function buildChaptersMetaCsv(slug: string, chapters: ExportChapter[]): string {
    const rows = [...chapters]
        .sort((a, b) => a.chapter_number - b.chapter_number)
                // Empty difficulty / minutes would fail the import's checks: write the table defaults instead.
        .map((c) => csvLine([slug, c.chapter_number, c.title, c.topic_tag, (c.difficulty || 'BEGINNER').toUpperCase(),
            c.est_minutes && c.est_minutes > 0 ? c.est_minutes : 60, c.story_hook, c.whatsapp_msg]));
    return [CHAPTERS_META_HEADERS.join(','), ...rows].join('\n') + '\n';
}

export function buildChapterStepsCsv(slug: string, steps: ExportStep[]): string {
    const rows = [...steps]
        .sort((a, b) => a.chapter_number - b.chapter_number || a.step_number - b.step_number)
        .map((s) => {
            const { step_type: _t, ...content } = (s.content ?? {}) as Record<string, unknown>;
            return csvLine([slug, s.chapter_number, s.step_number, s.type, s.title, JSON.stringify(content)]);
        });
    return [CHAPTER_STEPS_HEADERS.join(','), ...rows].join('\n') + '\n';
}

export class CourseLearningAdminService {
    static async getSettings(courseId: string) {
        const { rows } = await pool.query<{ id: string; drip_interval_days: number | null }>(
            'select id, drip_interval_days from public.courses where id = $1 and deleted_at is null', [courseId]);
        if (!rows[0]) return null;
        let prerequisites: { course_id: string; title: string; slug: string }[] = [];
        try {
            const r = await pool.query(
                `select c.id as course_id, c.title, c.slug from public.course_prerequisites p
                   join public.courses c on c.id = p.required_course_id
                  where p.course_id = $1 order by c.title`, [courseId]);
            prerequisites = r.rows;
        } catch (err) {
            if (!isMissingObject(err)) throw err;
        }
        return { course_id: courseId, drip_interval_days: rows[0].drip_interval_days, prerequisites };
    }

    /** Replace the course's drip interval and prerequisites. Errors: 'not_found', 'unknown_course', 'cycle'. */
    static async saveSettings(courseId: string, input: LearningSettingsInput, adminId: string) {
        const client = await pool.connect();
        try {
            await client.query('begin');
            const course = await client.query('select id from public.courses where id = $1 and deleted_at is null for update', [courseId]);
            if (!course.rows[0]) { await client.query('rollback'); return 'not_found' as const; }
            if (input.prerequisite_ids.length) {
                const known = await client.query('select count(*)::int as n from public.courses where id = any($1) and deleted_at is null', [input.prerequisite_ids]);
                if (known.rows[0].n !== input.prerequisite_ids.length) { await client.query('rollback'); return 'unknown_course' as const; }
            }
            await client.query('update public.courses set drip_interval_days = $2, updated_at = now() where id = $1', [courseId, input.drip_interval_days]);
            await client.query('delete from public.course_prerequisites where course_id = $1', [courseId]);
            for (const required of input.prerequisite_ids) {
                await client.query(
                    'insert into public.course_prerequisites (course_id, required_course_id, created_by) values ($1, $2, $3)',
                    [courseId, required, adminId]);
            }
            await client.query('commit');
        } catch (err) {
            await client.query('rollback').catch(() => undefined);
            if ((err as { code?: string }).code === '23514') return 'cycle' as const;
            throw err;
        } finally {
            client.release();
        }
        await CacheService.delPattern('courses:*').catch(() => undefined);
        return this.getSettings(courseId);
    }

    static async exportCourse(courseId: string, type: ExportType): Promise<{ slug: string; csv: string } | null> {
        const { rows } = await pool.query<{ slug: string }>('select slug from public.courses where id = $1', [courseId]);
        const slug = rows[0]?.slug;
        if (!slug) return null;
        if (type === 'chapters_meta') {
            const chapters = await pool.query<ExportChapter>(
                `select chapter_number, title, topic_tag, difficulty, est_minutes, story_hook, whatsapp_msg
                   from public.chapters where course_id = $1 order by chapter_number`, [courseId]);
            return { slug, csv: buildChaptersMetaCsv(slug, chapters.rows) };
        }
        const steps = await pool.query<ExportStep>(
            `select c.chapter_number, s.step_number, s.type, s.title, s.content
               from public.steps s join public.chapters c on c.id = s.chapter_id
              where c.course_id = $1 order by c.chapter_number, s.step_number`, [courseId]);
        return { slug, csv: buildChapterStepsCsv(slug, steps.rows) };
    }
}
