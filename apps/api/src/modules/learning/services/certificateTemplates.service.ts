import { pool } from '../../../config/database';
import { env } from '../../../config/env';
import { normalizeLayout, renderCertificatePdf, type CertificateLayout } from './certificateRenderer';

export type TemplateKind = 'topic' | 'apprenticeship';
export interface CertificateTemplate { id: string; kind: TemplateKind; name: string; isDefault: boolean; layout: CertificateLayout; updatedAt: string }

const COLS = `id, kind, name, is_default as "isDefault", layout, updated_at as "updatedAt"`;
const shape = (r: any): CertificateTemplate => ({ ...r, layout: normalizeLayout(r.layout) });

export const verifyUrlFor = (code: string) => `${(env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')}/certificates/verify/${code}`;

/** How certificates look: templates per kind, one default each, edited in the Forge admin. */
export class CertificateTemplatesService {
    static async list(): Promise<CertificateTemplate[]> {
        return (await pool.query(`select ${COLS} from public.certificate_templates order by kind, is_default desc, name`)).rows.map(shape);
    }

    /** A certificate's own template, else the kind's default (else built-in defaults). */
    static async forCertificate(kind: TemplateKind, templateId?: string | null): Promise<{ id: string | null; layout: CertificateLayout }> {
        const row = (await pool.query(
            `select ${COLS} from public.certificate_templates where (id = $1) or ($1 is null and kind = $2 and is_default)
              order by (id = $1) desc nulls last limit 1`, [templateId ?? null, kind]).catch(() => ({ rows: [] as any[] }))).rows[0];
        if (row) return { id: row.id, layout: normalizeLayout(row.layout) };
        if (templateId) return this.forCertificate(kind, null);
        return { id: null, layout: normalizeLayout({}) };
    }

    static async create(input: { kind: TemplateKind; name: string; layout: unknown; isDefault?: boolean }, adminId: string) {
        return this.inTx(async (c) => {
            if (input.isDefault) await c.query(`update public.certificate_templates set is_default = false where kind = $1 and is_default`, [input.kind]);
            const { rows } = await c.query(
                `insert into public.certificate_templates (kind, name, layout, is_default, created_by) values ($1, $2, $3, $4, $5) returning ${COLS}`,
                [input.kind, input.name, normalizeLayout(input.layout), input.isDefault ?? false, adminId]);
            return shape(rows[0]);
        });
    }

    static async update(id: string, input: { name?: string; layout?: unknown; isDefault?: boolean }) {
        return this.inTx(async (c) => {
            const current = (await c.query(`select kind, is_default from public.certificate_templates where id = $1 for update`, [id])).rows[0];
            if (!current) throw new Error('Template not found');
            if (input.isDefault === false && current.is_default) throw new Error('Make another template the default first');
            if (input.isDefault) await c.query(`update public.certificate_templates set is_default = false where kind = $1 and is_default and id <> $2`, [current.kind, id]);
            const { rows } = await c.query(
                `update public.certificate_templates set name = coalesce($2, name), layout = coalesce($3, layout),
                        is_default = coalesce($4, is_default), updated_at = now() where id = $1 returning ${COLS}`,
                [id, input.name ?? null, input.layout === undefined ? null : normalizeLayout(input.layout), input.isDefault ?? null]);
            return shape(rows[0]);
        });
    }

    /** Certificates already issued with it fall back to their kind's default. */
    static async remove(id: string) {
        const row = (await pool.query(`select is_default from public.certificate_templates where id = $1`, [id])).rows[0];
        if (!row) throw new Error('Template not found');
        if (row.is_default) throw new Error('The default template cannot be deleted');
        await pool.query(`delete from public.certificate_templates where id = $1`, [id]);
    }

    /** A sample certificate, for the admin's preview of unsaved changes. */
    static preview(kind: TemplateKind, layout: unknown) {
        return renderCertificatePdf(layout, {
            name: 'Aarav Sharma', achievement: kind === 'topic' ? 'Arrays & Hashing' : 'Full-Stack Apprenticeship',
            issuedAt: new Date(), code: 'SAMPLE12345', grade: 'Distinction', verifyUrl: verifyUrlFor('SAMPLE12345'),
        });
    }

    private static async inTx<T>(fn: (c: any) => Promise<T>): Promise<T> {
        const c = await pool.connect();
        try {
            await c.query('begin');
            const out = await fn(c);
            await c.query('commit');
            return out;
        } catch (e) {
            await c.query('rollback');
            throw e;
        } finally {
            c.release();
        }
    }
}
