import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';

/**
 * Course bundles: several Forge courses for one price. The catalogue shows what each
 * bundle contains, what the courses cost separately and, for a signed-in learner, which
 * of them they already have. Admins create and edit bundles; buying goes through
 * PaymentsV2Service.createBundleOrder.
 */

export interface BundleInput {
    slug: string;
    title: string;
    description?: string | null;
    coverImage?: string | null;
    price: number;          // paise
    isPublished?: boolean;
    courseIds: string[];
}

const LIST_SQL = `
  select b.id, b.slug, b.title, b.description, b.cover_image as "coverImage", b.price, b.currency,
         b.is_published as "isPublished", b.updated_at as "updatedAt",
         coalesce(json_agg(json_build_object(
             'id', c.id, 'title', c.title, 'slug', c.slug, 'difficulty', c.difficulty_level,
             'price', case when c.is_individually_purchasable then c.price end,
             'chapters', (select count(*) from public.chapters ch where ch.course_id = c.id))
           order by i.sort_order) filter (where c.id is not null), '[]') as courses
    from public.course_bundles b
    left join public.course_bundle_items i on i.bundle_id = b.id
    left join public.courses c on c.id = i.course_id and c.deleted_at is null`;

export class BundlesService {
    /** Published bundles (or one, by slug or id), with "owned" per course for a signed-in learner. */
    static async list(userId?: string, slugOrId?: string) {
        const where = slugOrId ? `and (b.slug = $1 or b.id::text = $1)` : '';
        const rows = (await pool.query(
            `${LIST_SQL} where b.is_published and b.deleted_at is null and (c.id is null or c.is_published) ${where}
             group by b.id order by b.created_at desc`, slugOrId ? [slugOrId] : [])).rows;
        const owned = new Set<string>();
        if (userId && rows.length) {
            const ids = rows.flatMap((r) => r.courses.map((c: { id: string }) => c.id));
            (await pool.query(
                `select resource_id from public.user_entitlements
                  where user_id = $1 and feature_key = 'course_access' and resource_type = 'course' and bool_value = true
                    and resource_id = any($2::uuid[]) and (expires_at is null or expires_at > now())`, [userId, ids])).rows
                .forEach((r) => owned.add(r.resource_id));
        }
        return rows.map((b) => {
            const separately = b.courses.reduce((s: number, c: { price: number | null }) => s + (c.price ?? 0), 0);
            const courses = b.courses.map((c: { id: string }) => ({ ...c, owned: owned.has(c.id) }));
            return {
                ...b,
                courses,
                // Only meaningful when every course has its own price.
                separatelyPrice: courses.every((c: { price: number | null }) => c.price != null) ? separately : null,
                ownedCount: courses.filter((c: { owned: boolean }) => c.owned).length,
            };
        });
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    static async adminList() {
        return (await pool.query(`${LIST_SQL} where b.deleted_at is null group by b.id order by b.created_at desc`)).rows;
    }

    static async create(input: BundleInput, adminId: string) {
        const client = await pool.connect();
        try {
            await client.query('begin');
            const { rows } = await client.query(
                `insert into public.course_bundles (slug, title, description, cover_image, price, is_published, created_by)
                 values ($1, $2, $3, $4, $5, $6, $7) returning id`,
                [input.slug, input.title, input.description ?? null, input.coverImage ?? null, input.price, input.isPublished ?? false, adminId]);
            await this.setItems(client, rows[0].id, input.courseIds);
            await client.query('commit');
            return { id: rows[0].id as string };
        } catch (e) {
            await client.query('rollback');
            throw e;
        } finally {
            client.release();
        }
    }

    static async update(id: string, input: Partial<BundleInput>) {
        const client = await pool.connect();
        try {
            await client.query('begin');
            const { rowCount } = await client.query(
                `update public.course_bundles set
                    slug = coalesce($2, slug), title = coalesce($3, title),
                    description = case when $4 then $5 else description end,
                    cover_image = case when $6 then $7 else cover_image end,
                    price = coalesce($8, price), is_published = coalesce($9, is_published), updated_at = now()
                  where id = $1 and deleted_at is null`,
                [id, input.slug ?? null, input.title ?? null, input.description !== undefined, input.description ?? null,
                    input.coverImage !== undefined, input.coverImage ?? null, input.price ?? null, input.isPublished ?? null]);
            if (!rowCount) throw new Error('Bundle not found');
            if (input.courseIds) await this.setItems(client, id, input.courseIds);
            if (input.isPublished) {
                const n = (await client.query(`select count(*)::int as n from public.course_bundle_items where bundle_id = $1`, [id])).rows[0].n;
                if (n < 2) throw new Error('A bundle needs at least two courses before it is published');
            }
            await client.query('commit');
        } catch (e) {
            await client.query('rollback');
            throw e;
        } finally {
            client.release();
        }
        await CacheService.delPattern('bundles:*');
    }

    /** Hidden from the catalogue; past buyers keep their courses. */
    static async remove(id: string) {
        const { rowCount } = await pool.query(
            `update public.course_bundles set deleted_at = now(), is_published = false, updated_at = now() where id = $1 and deleted_at is null`, [id]);
        if (!rowCount) throw new Error('Bundle not found');
    }

    private static async setItems(client: any, bundleId: string, courseIds: string[]) {
        await client.query(`delete from public.course_bundle_items where bundle_id = $1`, [bundleId]);
        for (const [i, courseId] of [...new Set(courseIds)].entries()) {
            await client.query(`insert into public.course_bundle_items (bundle_id, course_id, sort_order) values ($1, $2, $3)`, [bundleId, courseId, i]);
        }
    }
}
