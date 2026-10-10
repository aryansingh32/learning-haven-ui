import { pool } from '../../../config/database';
import logger from '../../../config/logger';
import { EntitlementsRepository } from '../../entitlements/entitlements.repository';
import { accessService } from '../../entitlements/access.service';

/** Errors from the campus helpers before their migration is applied: fall back safely. */
const MISSING = new Set(['42883', '3F000', '42P01']); // undefined function / schema / table

export interface CourseRow {
    id: string;
    is_premium: boolean | null;
    is_published: boolean | null;
    visibility: string | null;
    deleted_at: string | null;
}

/**
 * One place that decides who may see a course and who gets its premium
 * chapters. Learn (courses) and Campus (colleges) meet here.
 */
export class CourseAccessService {
    /** Any paid plan: an active subscription, or a plan set on the account (e.g. by an admin). */
    static async hasPaidPlan(userId: string): Promise<boolean> {
        const info = await EntitlementsRepository.getUserPlanAndEntitlements(userId);
        if (info.planSlug && info.planSlug !== 'free') return true;
        const { rows } = await pool.query<{ current_plan: string | null }>(`select current_plan from public.users where id = $1`, [userId]);
        const plan = rows[0]?.current_plan;
        return Boolean(plan) && plan !== 'free';
    }

    static isPublicCourse(c: CourseRow): boolean {
        return Boolean(c.is_published) && !c.deleted_at && (c.visibility ?? 'public') === 'public';
    }

    /** Published public courses for everyone; college courses only for the people they're for. */
    static async canSeeCourse(userId: string | null | undefined, course: CourseRow): Promise<boolean> {
        if (this.isPublicCourse(course)) return true;
        if (!userId || course.deleted_at) return false;
        try {
            const { rows } = await pool.query<{ ok: boolean }>(`select campus.user_can_see_course($1, $2) as ok`, [userId, course.id]);
            return rows[0]?.ok === true;
        } catch (err) {
            if (MISSING.has((err as { code?: string }).code ?? '')) return false;
            throw err;
        }
    }

    /** Is the learner's college licensed for this course? */
    static async hasCollegeLicence(userId: string, courseId: string): Promise<boolean> {
        try {
            const { rows } = await pool.query<{ ok: boolean }>(`select campus.user_has_course_licence($1, $2) as ok`, [userId, courseId]);
            return rows[0]?.ok === true;
        } catch (err) {
            if (MISSING.has((err as { code?: string }).code ?? '')) return false;
            logger.error('College licence check failed', { courseId, error: (err as Error).message });
            return false;
        }
    }

    /**
     * Premium chapters are open with: a paid plan, the course in the learner's
     * plan or bought on its own, or a licence held by their college.
     */
    static async hasPremiumAccess(userId: string, course: Pick<CourseRow, 'id' | 'is_premium'>): Promise<boolean> {
        if (!course.is_premium) return true;
        if (await this.hasPaidPlan(userId)) return true;
        const grant = await accessService.canAccess(userId, 'course', course.id).catch(() => ({ allowed: false }));
        if (grant.allowed) return true;
        return this.hasCollegeLicence(userId, course.id);
    }

    /**
     * A chapter whose content this learner may read: the course is visible to them and,
     * for premium courses, they have premium access. Null otherwise (treat as not found).
     */
    static async loadReadableChapter(userId: string, chapterId: string): Promise<{ id: string; course_id: string; chapter_number: number; title: string; course: CourseRow } | null> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId)) return null;
        const { rows } = await pool.query<{ id: string; course_id: string | null; chapter_number: number; title: string }>(
            `select id, course_id, chapter_number, title from public.chapters where id = $1`, [chapterId]);
        const chapter = rows[0];
        if (!chapter?.course_id) return null;
        const course = await this.loadCourse(chapter.course_id);
        if (!course || !(await this.canSeeCourse(userId, course))) return null;
        if (!(await this.hasPremiumAccess(userId, course))) return null;
        return { ...chapter, course_id: chapter.course_id, course };
    }

    static async loadCourse(courseId: string): Promise<CourseRow | null> {
        const { rows } = await pool.query<CourseRow>(
            `select id, is_premium, is_published, visibility::text as visibility, deleted_at from public.courses where id = $1`, [courseId]);
        return rows[0] ?? null;
    }
}
