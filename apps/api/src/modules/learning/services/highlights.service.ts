import { pool } from '../../../config/database';
import { CourseAccessService } from './courseAccess.service';
import { isMissingObject } from './learningGate.service';

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export const MAX_HIGHLIGHTS_PER_CHAPTER = 300;

export interface HighlightInput {
    text: string;
    prefix: string;
    suffix: string;
    start_offset: number;
    color: HighlightColor;
    step_id: string | null;
}

export interface Highlight extends HighlightInput {
    id: string;
    chapter_id: string;
    created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a highlight from the browser. Returns the clean value or an error message. */
export function parseHighlightInput(body: unknown): HighlightInput | string {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.text !== 'string' || !b.text.trim()) return 'Select some text to highlight';
    if (b.text.length > 2000) return 'A highlight can be at most 2000 characters';
    const ctx = (v: unknown) => (typeof v === 'string' ? v.slice(-64) : '');
    const color = b.color === undefined ? 'yellow' : b.color;
    if (!HIGHLIGHT_COLORS.includes(color as HighlightColor)) return 'Unknown highlight colour';
    const offset = b.start_offset === undefined ? 0 : Number(b.start_offset);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) return 'start_offset must be a whole number';
    if (b.step_id !== undefined && b.step_id !== null && (typeof b.step_id !== 'string' || !UUID.test(b.step_id))) return 'Invalid step_id';
    return {
        text: b.text,
        prefix: ctx(b.prefix),
        suffix: typeof b.suffix === 'string' ? b.suffix.slice(0, 64) : '',
        start_offset: offset,
        color: color as HighlightColor,
        step_id: (b.step_id as string | null | undefined) ?? null,
    };
}

export class HighlightsUnavailableError extends Error {
    constructor() {
        super('Highlights are not available yet');
    }
}

const COLUMNS = 'id, chapter_id, step_id, text, prefix, suffix, start_offset, color, created_at';

/** Text a learner highlighted in a chapter. Own rows only; the table may be missing on older databases. */
export class HighlightsService {
    static async listForChapter(userId: string, chapterId: string): Promise<{ available: boolean; highlights: Highlight[] }> {
        try {
            const { rows } = await pool.query<Highlight>(
                `select ${COLUMNS} from public.chapter_highlights where user_id = $1 and chapter_id = $2 order by start_offset, created_at`,
                [userId, chapterId],
            );
            return { available: true, highlights: rows };
        } catch (err) {
            if (isMissingObject(err)) return { available: false, highlights: [] };
            throw err;
        }
    }

    static async listForCourse(userId: string, chapterIds: string[]): Promise<Map<string, Highlight[]>> {
        const byChapter = new Map<string, Highlight[]>();
        if (!chapterIds.length) return byChapter;
        try {
            const { rows } = await pool.query<Highlight>(
                `select ${COLUMNS} from public.chapter_highlights where user_id = $1 and chapter_id = any($2) order by start_offset, created_at`,
                [userId, chapterIds],
            );
            for (const r of rows) byChapter.set(r.chapter_id, [...(byChapter.get(r.chapter_id) ?? []), r]);
        } catch (err) {
            if (!isMissingObject(err)) throw err;
        }
        return byChapter;
    }

    /** Null when the chapter isn't readable for this learner (treat as not found). */
    static async create(userId: string, chapterId: string, input: HighlightInput): Promise<Highlight | null | 'limit' | 'bad_step'> {
        const chapter = await CourseAccessService.loadReadableChapter(userId, chapterId);
        if (!chapter) return null;
        try {
            const { rows: count } = await pool.query<{ n: number }>(
                'select count(*)::int as n from public.chapter_highlights where user_id = $1 and chapter_id = $2', [userId, chapterId]);
            if ((count[0]?.n ?? 0) >= MAX_HIGHLIGHTS_PER_CHAPTER) return 'limit';
            const { rows } = await pool.query<Highlight>(
                `insert into public.chapter_highlights (user_id, chapter_id, step_id, text, prefix, suffix, start_offset, color)
                 values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${COLUMNS}`,
                [userId, chapterId, input.step_id, input.text, input.prefix, input.suffix, input.start_offset, input.color],
            );
            return rows[0];
        } catch (err) {
            if (isMissingObject(err)) throw new HighlightsUnavailableError();
            if ((err as { code?: string }).code === '23514') return 'bad_step'; // step not in this chapter
            throw err;
        }
    }

    static async recolor(userId: string, id: string, color: HighlightColor): Promise<Highlight | null> {
        if (!UUID.test(id)) return null;
        try {
            const { rows } = await pool.query<Highlight>(
                `update public.chapter_highlights set color = $3 where id = $1 and user_id = $2 returning ${COLUMNS}`, [id, userId, color]);
            return rows[0] ?? null;
        } catch (err) {
            if (isMissingObject(err)) return null;
            throw err;
        }
    }

    static async remove(userId: string, id: string): Promise<boolean> {
        if (!UUID.test(id)) return false;
        try {
            const { rowCount } = await pool.query('delete from public.chapter_highlights where id = $1 and user_id = $2', [id, userId]);
            return (rowCount ?? 0) > 0;
        } catch (err) {
            if (isMissingObject(err)) return false;
            throw err;
        }
    }
}
