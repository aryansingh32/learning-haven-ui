import {
    auditKind, checkNewPassword, cleanHandle, cleanPortfolio, cleanSkills, describeUserAgent, mergeAccountActivity,
    resumeSkillSuggestions, sessionClaims, suggestHandle,
} from '../modules/auth/services/accountHelpers';
import { firstSighting, isSessionRevoked, markSessionsRevoked } from '../modules/auth/services/sessionGuard';
import { AccountService } from '../modules/auth/services/account.service';
import { requireVerifiedEmail } from '../middleware/requireVerifiedEmail';

const SID = '6f1c0b9e-2d3a-4b5c-8d7e-9f0a1b2c3d4e';

describe('account helpers', () => {
    it('reads the session id, sign-in method and time from Supabase claims', () => {
        expect(sessionClaims({ session_id: SID.toUpperCase(), amr: [{ method: 'password', timestamp: 1760000000 }], app_metadata: { provider: 'email' } }))
            .toEqual({ sessionId: SID, method: 'password', provider: 'email', signedInAt: 1760000000 });
        expect(sessionClaims({ session_id: 'not-a-uuid' }).sessionId).toBeNull();
        expect(sessionClaims(null)).toEqual({ sessionId: null, method: null, provider: null, signedInAt: null });
    });

    it('names devices from user agents', () => {
        expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36').label).toBe('Chrome on Windows');
        expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'))
            .toMatchObject({ label: 'Safari on iOS', mobile: true });
        expect(describeUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 EdgA/129.0').label).toBe('Edge on Android');
        expect(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0').label).toBe('Firefox on Linux');
        expect(describeUserAgent('node').label).toBe('App or script');
        expect(describeUserAgent(null).label).toBe('Unknown device');
    });

    it('maps only meaningful audit-log actions', () => {
        expect(auditKind('login')).toBe('sign_in');
        expect(auditKind('user_updated_password')).toBe('password_changed');
        expect(auditKind('token_refreshed')).toBeNull();
        expect(auditKind(undefined)).toBeNull();
    });

    it('merges the account log newest first, before a cursor, up to a limit', () => {
        const row = (at: string) => ({ kind: 'sign_in' as const, at, source: 'account_log' as const, device: null, ip: null, detail: null });
        const items = [row('2026-10-01T00:00:00.000Z'), row('2026-10-03T00:00:00.000Z'), row('2026-10-02T00:00:00.000Z')];
        expect(mergeAccountActivity(items, 2).map((i) => i.at.slice(8, 10))).toEqual(['03', '02']);
        expect(mergeAccountActivity(items, 5, '2026-10-02T00:00:00.000Z').map((i) => i.at.slice(8, 10))).toEqual(['01']);
    });

    it('checks new passwords', () => {
        expect(checkNewPassword('old', 'short1')).toMatch(/8 characters/);
        expect(checkNewPassword('old', 'onlyletters')).toMatch(/letter and one number/);
        expect(checkNewPassword('same1234', 'same1234')).toMatch(/different/);
        expect(checkNewPassword('old', 'x'.repeat(73) + '1')).toMatch(/72/);
        expect(checkNewPassword('old', 'better-pass-42')).toBeNull();
    });

    it('cleans a skills list: trims, drops duplicates, checks levels and categories', () => {
        expect(cleanSkills([{ name: '  Java ', level: 'advanced', category: 'language' }, { name: 'java', level: 'beginner' }, { name: 'React', level: 'expert', category: '' }]))
            .toEqual({ ok: true, value: [{ name: 'Java', level: 'advanced', category: 'language' }, { name: 'React', level: 'expert', category: null }] });
        expect(cleanSkills([{ name: 'Go', level: 'guru' }])).toMatchObject({ ok: false });
        expect(cleanSkills([{ name: '<b>', level: 'expert' }])).toMatchObject({ ok: false });
        expect(cleanSkills([{ name: 'Go', level: 'expert', category: 'magic' }])).toMatchObject({ ok: false });
        expect(cleanSkills(Array.from({ length: 31 }, (_, i) => ({ name: `S${i}`, level: 'beginner' })))).toMatchObject({ ok: false });
        expect(cleanSkills('Java')).toMatchObject({ ok: false });
    });

    it('suggests skills from the resume builder that are not declared yet', () => {
        const resume = { skills: { languages: 'Java, Python,  ', frameworks: 'React;Spring Boot', tools: 'Git', softSkills: '' } };
        expect(resumeSkillSuggestions(resume, ['python'])).toEqual([
            { name: 'Java', category: 'language' }, { name: 'React', category: 'framework' }, { name: 'Spring Boot', category: 'framework' }, { name: 'Git', category: 'tool' },
        ]);
        expect(resumeSkillSuggestions(null, [])).toEqual([]);
    });

    it('validates handles and suggests one from a name', () => {
        expect(cleanHandle(' Priya-S ')).toEqual({ ok: true, value: 'priya-s' });
        for (const bad of ['ab', '-priya', 'priya-', 'pri--ya', 'priya_s', 'a'.repeat(31), 'admin', 'प्रिया']) expect(cleanHandle(bad)).toMatchObject({ ok: false });
        expect(suggestHandle('Priya Sharma')).toBe('priya-sharma');
        expect(suggestHandle('Jö')).toMatch(/^learner-[a-z0-9]+$/);
        expect(cleanHandle(suggestHandle('A very long name that goes on and on forever'))).toMatchObject({ ok: true });
    });

    it('cleans portfolio settings: private and minimal by default', () => {
        const r = cleanPortfolio({ handle: 'priya-s' });
        expect(r).toEqual({ ok: true, value: {
            handle: 'priya-s', is_public: false, headline: null, bio: null, show_college: false, show_skills: true, show_evidence: true,
            show_repo_links: false, certificate_refs: [], project_ids: [],
        } });
        expect(cleanPortfolio({ handle: 'priya-s', certificate_refs: ['topic:' + SID, 'topic:' + SID] })).toMatchObject({ ok: true, value: { certificate_refs: ['topic:' + SID] } });
        expect(cleanPortfolio({ handle: 'priya-s', certificate_refs: ['user:' + SID] })).toMatchObject({ ok: false });
        expect(cleanPortfolio({ handle: 'priya-s', project_ids: ['1'] })).toMatchObject({ ok: false });
        expect(cleanPortfolio({ handle: 'priya-s', headline: 'x'.repeat(121) })).toMatchObject({ ok: false, error: expect.stringMatching(/Headline/) });
        expect(cleanPortfolio({ handle: 'no' })).toMatchObject({ ok: false });
    });
});

describe('session guard', () => {
    it('refuses a revoked session at once in this process', async () => {
        expect(await isSessionRevoked(SID)).toBe(false);
        await markSessionsRevoked([SID]);
        expect(await isSessionRevoked(SID)).toBe(true);
        expect(await isSessionRevoked(null)).toBe(false);
    });

    it('records a session once per process', () => {
        const id = '11111111-2222-3333-4444-555555555555';
        expect(firstSighting(id)).toBe(true);
        expect(firstSighting(id)).toBe(false);
    });
});

describe('requireVerifiedEmail', () => {
    const run = async (verified: boolean | Error) => {
        const spy = jest.spyOn(AccountService, 'isEmailVerified');
        if (verified instanceof Error) spy.mockRejectedValueOnce(verified); else spy.mockResolvedValueOnce(verified);
        const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        const next = jest.fn();
        await requireVerifiedEmail({ user: { id: 'u1' } } as any, res, next);
        return { res, next };
    };

    it('lets verified learners through', async () => {
        const { next, res } = await run(true);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('stops unverified learners with a clear code', async () => {
        const { next, res } = await run(false);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }) }));
    });

    it('does not block checkout when the check itself fails', async () => {
        const { next } = await run(new Error('db down'));
        expect(next).toHaveBeenCalled();
    });
});
