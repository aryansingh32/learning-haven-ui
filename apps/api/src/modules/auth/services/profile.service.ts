import { pool } from '../../../config/database';
import { AccountError, AccountEvents, AccountService, RequestContext, isMissing } from './account.service';
import { PortfolioInput, SkillInput, resumeSkillSuggestions, suggestHandle } from './accountHelpers';

/**
 * Skills profile and public portfolio (slice W2-A1).
 * Skills: what the learner declares (public.user_skills) plus what Forge can
 * show (public.skill_evidence: judge-accepted solves, certificates, finished
 * projects). Portfolio: opt-in page at /u/<handle> built by
 * public.public_portfolio(), which only ever returns what the learner picked.
 */

const rowsOrEmpty = async (sql: string, params: unknown[]) => {
    try {
        return (await pool.query(sql, params)).rows;
    } catch (error: any) {
        if (isMissing(error)) return [];
        throw error;
    }
};

export class ProfileService {
    static async getSkills(userId: string) {
        const skills = await rowsOrEmpty(
            `select name, level, category from public.user_skills where user_id = $1 order by sort_order, lower(name)`, [userId]);
        const evidence = await rowsOrEmpty(`select skill, source, detail, amount from public.skill_evidence($1)`, [userId]);
        // The resume builder's table is missing on some databases; then there's simply nothing to suggest.
        const resume = await rowsOrEmpty(`select data from public.user_resumes where user_id = $1`, [userId]);
        return {
            skills,
            evidence: evidence.map((e) => ({ skill: e.skill, source: e.source, detail: e.source === 'project' ? e.detail : null, amount: e.amount })),
            suggestions: resumeSkillSuggestions(resume[0]?.data, skills.map((s) => s.name)),
        };
    }

    /** Replaces the whole list (order = display order). */
    static async saveSkills(userId: string, skills: SkillInput[]) {
        const client = await pool.connect();
        try {
            await client.query('begin');
            await client.query(`delete from public.user_skills where user_id = $1`, [userId]);
            for (const [i, s] of skills.entries()) {
                await client.query(
                    `insert into public.user_skills (user_id, name, level, category, sort_order) values ($1, $2, $3, $4, $5)`,
                    [userId, s.name, s.level, s.category, i],
                );
            }
            await client.query('commit');
        } catch (error: any) {
            await client.query('rollback').catch(() => undefined);
            if (error?.code === '23514' || error?.code === '23505') throw new AccountError(400, 'Some skills could not be saved. Check names and levels.');
            if (isMissing(error)) throw new AccountError(503, 'Skills profiles are not available yet.', 'UNAVAILABLE');
            throw error;
        } finally {
            client.release();
        }
        return ProfileService.getSkills(userId);
    }

    /** What the settings page needs: the saved portfolio (or a suggested handle) and everything that can be shown on it. */
    static async getPortfolio(userId: string) {
        const [row] = await rowsOrEmpty(`select * from public.learner_portfolios where user_id = $1`, [userId]);
        const [user] = await rowsOrEmpty(`select full_name, college_name from public.users where id = $1`, [userId]);
        const certificates = [
            ...(await rowsOrEmpty(`select 'topic:' || id as ref, topic as title, issued_at from public.certificates where user_id = $1`, [userId])),
            ...(await rowsOrEmpty(
                `select 'apprenticeship:' || c.id as ref, ap.title, c.issued_at from public.apprenticeship_certificates c
                   join public.apprenticeship_programs ap on ap.id = c.program_id where c.user_id = $1`, [userId])),
            ...(await rowsOrEmpty(
                `select 'program:' || c.id as ref, p.title, c.issued_at from public.program_certificates c
                   join public.programs p on p.id = c.program_id where c.user_id = $1 and c.status = 'issued' and c.revoked_at is null`, [userId])),
        ].sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at)));
        const projects = await rowsOrEmpty(
            `select b.id, ap.title, b.language, b.status, coalesce(cardinality(b.completed_stages), 0) as stages_done, b.total_stages,
                    b.repo_url is not null as has_repo
               from public.build_enrollments b join public.apprenticeship_programs ap on ap.id = b.program_id
              where b.user_id = $1 and b.deleted_at is null order by (b.status = 'completed') desc, b.updated_at desc`, [userId]);
        let emailVerified = true;
        try { emailVerified = await AccountService.isEmailVerified(userId); } catch { /* shown as verified; the database still refuses */ }
        return {
            portfolio: row ? {
                handle: row.handle, is_public: row.is_public, headline: row.headline, bio: row.bio,
                show_college: row.show_college, show_skills: row.show_skills, show_evidence: row.show_evidence, show_repo_links: row.show_repo_links,
                certificate_refs: row.certificate_refs, project_ids: row.project_ids, published_at: row.published_at,
            } : null,
            suggested_handle: suggestHandle(user?.full_name),
            has_college: Boolean(user?.college_name),
            email_verified: emailVerified,
            certificates: certificates.map((c) => ({ ref: c.ref, title: c.title, issued_at: c.issued_at })),
            projects: projects.map((p) => ({ id: p.id, title: p.title, language: p.language, status: p.status, stages_done: p.stages_done, stages_total: p.total_stages, has_repo: p.has_repo })),
        };
    }

    static async savePortfolio(userId: string, input: PortfolioInput, ctx: RequestContext) {
        if (input.is_public && !(await AccountService.isEmailVerified(userId))) {
            throw new AccountError(403, 'Verify your email before making your portfolio public.', 'EMAIL_NOT_VERIFIED');
        }
        const [before] = await rowsOrEmpty(`select is_public from public.learner_portfolios where user_id = $1`, [userId]);
        try {
            await pool.query(
                `insert into public.learner_portfolios (user_id, handle, is_public, headline, bio, show_college, show_skills, show_evidence,
                                                        show_repo_links, certificate_refs, project_ids)
                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 on conflict (user_id) do update set handle = excluded.handle, is_public = excluded.is_public, headline = excluded.headline,
                   bio = excluded.bio, show_college = excluded.show_college, show_skills = excluded.show_skills, show_evidence = excluded.show_evidence,
                   show_repo_links = excluded.show_repo_links, certificate_refs = excluded.certificate_refs, project_ids = excluded.project_ids`,
                [userId, input.handle, input.is_public, input.headline, input.bio, input.show_college, input.show_skills, input.show_evidence,
                 input.show_repo_links, input.certificate_refs, input.project_ids],
            );
        } catch (error: any) {
            if (error?.code === '23505') throw new AccountError(409, 'That address is taken. Try another.', 'CONFLICT');
            if (error?.code === '23514') throw new AccountError(400, /verify/i.test(error.message) ? 'Verify your email before making your portfolio public.' : error.message || 'Some choices could not be saved.');
            if (isMissing(error)) throw new AccountError(503, 'Portfolios are not available yet.', 'UNAVAILABLE');
            throw error;
        }
        const was = Boolean(before?.is_public);
        if (input.is_public !== was) await AccountEvents.record(userId, input.is_public ? 'portfolio_published' : 'portfolio_unpublished', ctx, { handle: input.handle });
        return ProfileService.getPortfolio(userId);
    }

    static async deletePortfolio(userId: string, ctx: RequestContext) {
        const rows = await rowsOrEmpty(`delete from public.learner_portfolios where user_id = $1 returning handle, is_public`, [userId]);
        if (rows[0]?.is_public) await AccountEvents.record(userId, 'portfolio_unpublished', ctx, { handle: rows[0].handle, deleted: true });
        return { deleted: rows.length > 0 };
    }

    static async publicPortfolio(handle: string) {
        const rows = await rowsOrEmpty(`select public.public_portfolio($1) as v`, [handle]);
        return rows[0]?.v ?? null;
    }
}
