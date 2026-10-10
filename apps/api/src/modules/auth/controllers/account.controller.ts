import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import logger from '../../../config/logger';
import { AccountError, AccountService, RequestContext } from '../services/account.service';
import { ProfileService } from '../services/profile.service';
import { checkNewPassword, cleanHandle, cleanPortfolio, cleanSkills } from '../services/accountHelpers';

/** Account & security, skills profile and portfolio endpoints (slice W2-A1). Plain JSON; errors are { error, code }. */

const me = (req: Request) => (req as AuthRequest).user!;
const ctx = (req: Request): RequestContext => ({
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    sessionId: (req as AuthRequest).user?.session_id ?? null,
});

function handle(res: Response, error: unknown, what: string) {
    if (error instanceof AccountError) return res.status(error.status).json({ error: error.message, code: error.code });
    logger.error(`${what} error:`, error);
    return res.status(500).json({ error: `Could not ${what.toLowerCase()}. Try again.` });
}

export class AccountController {
    /** GET /users/me/account */
    static async getAccount(req: Request, res: Response) {
        try { return res.json(await AccountService.getInfo(me(req).id)); } catch (e) { return handle(res, e, 'Load account'); }
    }

    /** POST /users/me/verification-email */
    static async sendVerification(req: Request, res: Response) {
        try { return res.json(await AccountService.sendVerificationForUser(me(req).id, ctx(req))); } catch (e) { return handle(res, e, 'Send the email'); }
    }

    /** POST /auth/resend-verification { email } — for someone who can't sign in yet. Always the same answer. */
    static async resendPublic(req: Request, res: Response) {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
        try {
            await AccountService.resendVerification(email);
        } catch (e) {
            if (e instanceof AccountError && e.status === 429) return res.status(429).json({ error: e.message, code: e.code });
            // Unknown or already verified addresses get the same reply, so this can't be used to probe accounts.
        }
        return res.json({ sent: true });
    }

    /** GET /users/me/sessions */
    static async listSessions(req: Request, res: Response) {
        try { return res.json(await AccountService.listSessions(me(req).id, ctx(req).sessionId ?? null)); } catch (e) { return handle(res, e, 'Load sessions'); }
    }

    /** DELETE /users/me/sessions/:sessionId */
    static async revokeSession(req: Request, res: Response) {
        try { return res.json(await AccountService.revokeSession(me(req).id, String(req.params.sessionId).toLowerCase(), ctx(req))); } catch (e) { return handle(res, e, 'Sign out that session'); }
    }

    /** POST /users/me/sessions/revoke-others */
    static async revokeOthers(req: Request, res: Response) {
        try { return res.json(await AccountService.revokeOtherSessions(me(req).id, ctx(req))); } catch (e) { return handle(res, e, 'Sign out other sessions'); }
    }

    /** PUT /users/me/password { current_password, new_password, sign_out_others } */
    static async changePassword(req: Request, res: Response) {
        const { current_password, new_password, sign_out_others } = req.body ?? {};
        if (typeof current_password !== 'string' || !current_password) return res.status(400).json({ error: 'Enter your current password.' });
        const problem = checkNewPassword(current_password, new_password);
        if (problem) return res.status(400).json({ error: problem });
        try {
            return res.json(await AccountService.changePassword(me(req).id, current_password, new_password, sign_out_others !== false, ctx(req)));
        } catch (e) { return handle(res, e, 'Change the password'); }
    }

    /** GET /users/me/activity?before=<iso>&limit=<1-50> */
    static async getActivity(req: Request, res: Response) {
        const before = typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before).toISOString() : null;
        const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '30'), 10) || 30, 1), 50);
        try { return res.json(await AccountService.activity(me(req).id, before, limit)); } catch (e) { return handle(res, e, 'Load activity'); }
    }

    /** GET /users/me/skills */
    static async getSkills(req: Request, res: Response) {
        try { return res.json(await ProfileService.getSkills(me(req).id)); } catch (e) { return handle(res, e, 'Load skills'); }
    }

    /** PUT /users/me/skills { skills: [{ name, level, category? }] } */
    static async saveSkills(req: Request, res: Response) {
        const cleaned = cleanSkills(req.body?.skills);
        if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
        try { return res.json(await ProfileService.saveSkills(me(req).id, cleaned.value)); } catch (e) { return handle(res, e, 'Save skills'); }
    }

    /** GET /users/me/portfolio */
    static async getPortfolio(req: Request, res: Response) {
        try { return res.json(await ProfileService.getPortfolio(me(req).id)); } catch (e) { return handle(res, e, 'Load portfolio'); }
    }

    /** PUT /users/me/portfolio */
    static async savePortfolio(req: Request, res: Response) {
        const cleaned = cleanPortfolio(req.body ?? {});
        if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
        try { return res.json(await ProfileService.savePortfolio(me(req).id, cleaned.value, ctx(req))); } catch (e) { return handle(res, e, 'Save portfolio'); }
    }

    /** DELETE /users/me/portfolio */
    static async deletePortfolio(req: Request, res: Response) {
        try { return res.json(await ProfileService.deletePortfolio(me(req).id, ctx(req))); } catch (e) { return handle(res, e, 'Delete portfolio'); }
    }

    /** GET /portfolio/:handle — public; only published portfolios, never cached so unpublishing is immediate. */
    static async getPublicPortfolio(req: Request, res: Response) {
        res.set('Cache-Control', 'no-store');
        res.set('X-Robots-Tag', 'noindex');
        const h = cleanHandle(req.params.handle);
        if ('error' in h) return res.status(404).json({ error: 'Portfolio not found' });
        try {
            const view = await ProfileService.publicPortfolio(h.value);
            if (!view) return res.status(404).json({ error: 'Portfolio not found' });
            return res.json(view);
        } catch (e) { return handle(res, e, 'Load portfolio'); }
    }
}
