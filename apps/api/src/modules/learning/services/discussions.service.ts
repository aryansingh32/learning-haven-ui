import { pool } from '../../../config/database';
import logger from '../../../config/logger';
import { CourseAccessService } from './courseAccess.service';
import { isMissingObject } from './learningGate.service';

const FORGE_ORG = '00000000-0000-0000-0000-00000000f0f0';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REPORT_REASONS = ['spam', 'abuse', 'off_topic', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const MAX_POST_LENGTH = 4000;
/** Posts per learner per minute, to slow down spam. */
export const POSTS_PER_MINUTE = 5;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Clean a post body; returns the text or an error message. */
export function parsePostBody(body: unknown): { body: string } | { error: string } {
    if (typeof body !== 'string' || !body.trim()) return { error: 'Write something first' };
    const text = body.trim();
    if (text.length > MAX_POST_LENGTH) return { error: `A post can be at most ${MAX_POST_LENGTH} characters` };
    return { body: text };
}

export interface PostRow {
    id: string;
    parent_id: string | null;
    user_id: string;
    author_name: string | null;
    body: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    hidden_at: string | null;
    hidden_reason: string | null;
    reported_by_me: boolean;
    open_reports: number;
}

export interface PostView {
    id: string;
    parent_id: string | null;
    author_name: string;
    mine: boolean;
    body: string;
    created_at: string;
    edited_at: string | null;
    deleted: boolean;
    hidden: boolean;
    hidden_reason: string | null;
    reported_by_me: boolean;
    open_reports?: number;
    replies: PostView[];
}

/**
 * Shape rows into threads: top-level posts (oldest first) with their replies.
 * Deleted posts keep their place only while they have replies, with no text.
 * Hidden posts reach only their author and staff (the query already filters).
 */
export function buildThreads(rows: PostRow[], viewerId: string, isStaff: boolean): PostView[] {
    const view = (r: PostRow): PostView => ({
        id: r.id,
        parent_id: r.parent_id,
        author_name: r.deleted_at ? '' : (r.author_name || 'Learner'),
        mine: r.user_id === viewerId,
        body: r.deleted_at ? '' : r.body,
        created_at: r.created_at,
        edited_at: r.edited_at,
        deleted: Boolean(r.deleted_at),
        hidden: Boolean(r.hidden_at),
        hidden_reason: isStaff || r.user_id === viewerId ? r.hidden_reason : null,
        reported_by_me: r.reported_by_me,
        ...(isStaff ? { open_reports: r.open_reports } : {}),
        replies: [],
    });
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const tops = new Map<string, PostView>();
    for (const r of sorted) if (!r.parent_id) tops.set(r.id, view(r));
    for (const r of sorted) {
        if (!r.parent_id || r.deleted_at) continue;
        tops.get(r.parent_id)?.replies.push(view(r));
    }
    return [...tops.values()].filter((t) => !t.deleted || t.replies.length > 0);
}

export class DiscussionsUnavailableError extends Error {
    constructor() {
        super('Discussions are not available yet');
    }
}

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

/**
 * Per-chapter discussion threads. Anyone who can read the chapter's course can
 * read and post; authors edit/delete their own posts; anyone can report; staff
 * (Forge admins, or the owning college's content staff) hide and unhide.
 * The server checks access itself (it uses the service connection); the
 * table's RLS enforces the same rules for direct database access.
 */
export class DiscussionsService {
    static async isStaff(userId: string, course: { id: string }): Promise<boolean> {
        const { rows } = await pool.query<{ role: string | null; owner_org_id: string | null }>(
            `select u.role, c.owner_org_id from public.users u, public.courses c where u.id = $1 and c.id = $2`, [userId, course.id]);
        const row = rows[0];
        if (!row) return false;
        if (['admin', 'super_admin'].includes(row.role ?? '')) return true;
        if (!row.owner_org_id || row.owner_org_id === FORGE_ORG) return false;
        try {
            const { rows: perms } = await pool.query<{ ok: boolean }>(
                `select 'content.create' = any(campus.user_permissions($1, $2)) as ok`, [row.owner_org_id, userId]);
            return perms[0]?.ok === true;
        } catch (err) {
            if (isMissingObject(err)) return false;
            throw err;
        }
    }

    private static async loadPost(id: string) {
        const { rows } = await pool.query<{ id: string; chapter_id: string; course_id: string; user_id: string; parent_id: string | null; deleted_at: string | null; hidden_at: string | null }>(
            `select id, chapter_id, course_id, user_id, parent_id, deleted_at, hidden_at from public.chapter_discussion_posts where id = $1`, [id]);
        return rows[0] ?? null;
    }

    private static wrap<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
        return fn().catch((err) => {
            if (isMissingObject(err)) throw new DiscussionsUnavailableError();
            throw err;
        });
    }

    static async list(userId: string, chapterId: string): Promise<Result<{ can_moderate: boolean; posts: PostView[] }>> {
        const chapter = await CourseAccessService.loadReadableChapter(userId, chapterId);
        if (!chapter) return fail(404, 'Chapter not found');
        const staff = await this.isStaff(userId, chapter.course);
        try {
            const { rows } = await pool.query<PostRow>(
                `select p.id, p.parent_id, p.user_id, u.full_name as author_name, p.body,
                        to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
                        p.edited_at, p.deleted_at, p.hidden_at, p.hidden_reason,
                        exists (select 1 from public.chapter_discussion_reports r where r.post_id = p.id and r.reporter_id = $2) as reported_by_me,
                        (select count(*)::int from public.chapter_discussion_reports r where r.post_id = p.id and r.resolved_at is null) as open_reports
                   from public.chapter_discussion_posts p
                   left join public.users u on u.id = p.user_id
                  where p.chapter_id = $1 and (p.hidden_at is null or p.user_id = $2 or $3)
                  order by p.created_at
                  limit 1000`,
                [chapterId, userId, staff],
            );
            return { ok: true, value: { can_moderate: staff, posts: buildThreads(rows, userId, staff) } };
        } catch (err) {
            if (isMissingObject(err)) throw new DiscussionsUnavailableError();
            throw err;
        }
    }

    static create(userId: string, chapterId: string, body: string, parentId: string | null): Promise<Result<{ id: string }>> {
        return this.wrap(async () => {
            const chapter = await CourseAccessService.loadReadableChapter(userId, chapterId);
            if (!chapter) return fail(404, 'Chapter not found');
            if (parentId) {
                const parent = await this.loadPost(parentId);
                if (!parent || parent.chapter_id !== chapterId || parent.parent_id) return fail(400, 'You can only reply to a post in this chapter');
                if (parent.deleted_at || (parent.hidden_at && parent.user_id !== userId)) return fail(400, 'That post is no longer available');
            }
            const { rows: recent } = await pool.query<{ n: number }>(
                `select count(*)::int as n from public.chapter_discussion_posts where user_id = $1 and created_at > now() - interval '1 minute'`, [userId]);
            if ((recent[0]?.n ?? 0) >= POSTS_PER_MINUTE) return fail(429, 'You are posting too fast. Wait a minute and try again.');
            const { rows } = await pool.query<{ id: string }>(
                `insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, parent_id, body)
                 values ($1, $2, $3, $4, $5) returning id`,
                [chapter.course_id, chapterId, userId, parentId, body],
            );
            return { ok: true, value: rows[0] };
        });
    }

    /** The author edits their post (not while it's hidden or after deleting it). */
    static edit(userId: string, postId: string, body: string): Promise<Result<{ id: string }>> {
        return this.wrap(async () => {
            const post = await this.loadPost(postId);
            if (!post || !(await CourseAccessService.loadReadableChapter(userId, post.chapter_id))) return fail(404, 'Post not found');
            if (post.user_id !== userId) return fail(403, 'You can only edit your own posts');
            if (post.deleted_at) return fail(400, 'This post was deleted');
            if (post.hidden_at) return fail(403, 'A moderator hid this post, so it can no longer be edited');
            await pool.query('update public.chapter_discussion_posts set body = $2 where id = $1', [postId, body]);
            return { ok: true, value: { id: postId } };
        });
    }

    /** The author deletes their post (soft delete: replies keep their thread). Staff may delete any post. */
    static remove(userId: string, postId: string): Promise<Result<{ id: string }>> {
        return this.wrap(async () => {
            const post = await this.loadPost(postId);
            const chapter = post ? await CourseAccessService.loadReadableChapter(userId, post.chapter_id) : null;
            if (!post || !chapter) return fail(404, 'Post not found');
            if (post.user_id !== userId && !(await this.isStaff(userId, chapter.course))) return fail(403, 'You can only delete your own posts');
            if (!post.deleted_at) await pool.query('update public.chapter_discussion_posts set deleted_at = now() where id = $1', [postId]);
            return { ok: true, value: { id: postId } };
        });
    }

    static report(userId: string, postId: string, reason: ReportReason, details: string | null): Promise<Result<{ id: string }>> {
        return this.wrap(async () => {
            const post = await this.loadPost(postId);
            const chapter = post ? await CourseAccessService.loadReadableChapter(userId, post.chapter_id) : null;
            if (!post || !chapter || post.deleted_at || (post.hidden_at && post.user_id !== userId)) return fail(404, 'Post not found');
            if (post.user_id === userId) return fail(400, 'You cannot report your own post');
            await pool.query(
                `insert into public.chapter_discussion_reports (post_id, reporter_id, reason, details) values ($1, $2, $3, $4)
                 on conflict (post_id, reporter_id) do update set reason = excluded.reason, details = excluded.details, resolved_at = null, resolved_by = null`,
                [postId, userId, reason, details],
            );
            logger.info('Discussion post reported', { postId, reason });
            return { ok: true, value: { id: postId } };
        });
    }

    /** Staff hide (or unhide) a post. Hiding resolves its open reports. */
    static moderate(userId: string, postId: string, hidden: boolean, reason: string | null): Promise<Result<{ id: string; hidden: boolean }>> {
        return this.wrap(async () => {
            const post = await this.loadPost(postId);
            const chapter = post ? await CourseAccessService.loadReadableChapter(userId, post.chapter_id) : null;
            if (!post || !chapter) return fail(404, 'Post not found');
            if (!(await this.isStaff(userId, chapter.course))) return fail(403, 'Only course staff can hide posts');
            const client = await pool.connect();
            try {
                await client.query('begin');
                await client.query(
                    hidden
                        ? `update public.chapter_discussion_posts set hidden_at = now(), hidden_by = $2, hidden_reason = $3 where id = $1`
                        : `update public.chapter_discussion_posts set hidden_at = null, hidden_by = null, hidden_reason = null where id = $1`,
                    hidden ? [postId, userId, reason] : [postId],
                );
                await client.query(
                    `update public.chapter_discussion_reports set resolved_at = now(), resolved_by = $2 where post_id = $1 and resolved_at is null`,
                    [postId, userId]);
                await client.query('commit');
            } catch (err) {
                await client.query('rollback').catch(() => undefined);
                throw err;
            } finally {
                client.release();
            }
            return { ok: true, value: { id: postId, hidden } };
        });
    }
}
