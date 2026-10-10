/**
 * Admin control centre: flag evaluation, rollout buckets, announcements, the
 * maintenance / kill-switch / sign-up gates, secret masking and CSV export cells.
 */
const state = {
    maintenance: false,
    maintenanceMessage: 'Back soon',
    signupsOpen: true,
    flags: [] as any[],
    announcements: [] as any[],
};
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({ pool: { query: (...a: unknown[]) => mockQuery(...a) }, supabase: {} }));
jest.mock('../utils/supabaseJwt', () => ({
    verifySupabaseAccessToken: (t: string) => (t === 'admin-token' ? { id: 'a1' } : t === 'learner-token' ? { id: 'u1' } : null),
}));
jest.mock('../modules/learning/services/problems.service', () => ({ ProblemsService: { userColleges: jest.fn().mockResolvedValue([]) } }));

import {
    announcementApplies, ControlCentre, evaluateFlag, rolloutBucket, settingValue, Flag, Announcement,
} from '../modules/core/services/controlCentre.service';
import { maintenanceGate, moduleGate, signupGate } from '../middleware/controlGates';
import { isMasked, keyStatus, maskSecret, maskSettings, MASK } from '../modules/admin/services/secrets';
import { csvCell } from '../modules/admin/services/adminUsers.service';

const flag = (over: Partial<Flag> = {}): Flag => ({
    key: 'practice.new_editor', kind: 'release', enabled: true, rollout: 0, orgIds: [], description: null, updatedAt: '', ...over,
});

function run(mw: any, req: any) {
    return new Promise<{ status: number; body: any; next: boolean }>((resolve) => {
        const res: any = {
            statusCode: 200, headers: {} as Record<string, string>,
            status(c: number) { this.statusCode = c; return this; },
            setHeader(k: string, v: string) { this.headers[k] = v; },
            json(b: any) { resolve({ status: this.statusCode, body: b, next: false }); return this; },
        };
        mw(req, res, () => resolve({ status: 200, body: null, next: true }));
    });
}

beforeEach(() => {
    jest.spyOn(ControlCentre, 'state').mockImplementation(async () => state as any);
    Object.assign(state, { maintenance: false, signupsOpen: true, flags: [] });
    mockQuery.mockReset();
});
afterEach(() => jest.restoreAllMocks());

describe('settings values', () => {
    it('reads plain and double-encoded JSON settings alike', () => {
        expect(settingValue(true)).toBe(true);
        expect(settingValue('"true"')).toBe(true);
        expect(settingValue('"\\"Back soon\\""')).toBe('Back soon');
        expect(settingValue('not json')).toBe('not json');
    });
});

describe('feature flags', () => {
    it('off flags are off for everyone', () => {
        expect(evaluateFlag(flag({ enabled: false, rollout: 100 }), 'u1', [])).toBe(false);
    });
    it('100% rollout reaches visitors too; 0% reaches nobody outside chosen colleges', () => {
        expect(evaluateFlag(flag({ rollout: 100 }), null, [])).toBe(true);
        expect(evaluateFlag(flag({ rollout: 0 }), 'u1', [])).toBe(false);
        expect(evaluateFlag(flag({ rollout: 0, orgIds: ['org-1'] }), 'u1', ['org-1'])).toBe(true);
        expect(evaluateFlag(flag({ rollout: 50 }), null, [])).toBe(false);
    });
    it('a learner\'s bucket is stable and roughly matches the percentage', () => {
        expect(rolloutBucket('k', 'user-1')).toBe(rolloutBucket('k', 'user-1'));
        const on = Array.from({ length: 2000 }, (_, i) => evaluateFlag(flag({ rollout: 30 }), `user-${i}`, [])).filter(Boolean).length;
        expect(on).toBeGreaterThan(500);
        expect(on).toBeLessThan(700);
    });
    it('kill switches are simply on or off', () => {
        expect(evaluateFlag(flag({ kind: 'kill_switch', rollout: 0 }), null, [])).toBe(true);
        expect(evaluateFlag(flag({ kind: 'kill_switch', enabled: false }), 'u1', [])).toBe(false);
    });
});

describe('announcements', () => {
    const a = (over: Partial<Announcement> = {}): Announcement => ({
        id: '1', title: 'T', body: '', level: 'info', audience: 'everyone', linkUrl: null, linkLabel: null,
        startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: null, isActive: true, ...over,
    });
    const visitor = { signedIn: false, inCollege: false };
    it('shows only inside its window and while active', () => {
        expect(announcementApplies(a(), visitor)).toBe(true);
        expect(announcementApplies(a({ isActive: false }), visitor)).toBe(false);
        expect(announcementApplies(a({ startsAt: new Date(Date.now() + 60_000).toISOString() }), visitor)).toBe(false);
        expect(announcementApplies(a({ endsAt: new Date(Date.now() - 1).toISOString() }), visitor)).toBe(false);
    });
    it('respects its audience', () => {
        expect(announcementApplies(a({ audience: 'signed_in' }), visitor)).toBe(false);
        expect(announcementApplies(a({ audience: 'signed_in' }), { signedIn: true, inCollege: false })).toBe(true);
        expect(announcementApplies(a({ audience: 'colleges' }), { signedIn: true, inCollege: false })).toBe(false);
        expect(announcementApplies(a({ audience: 'colleges' }), { signedIn: true, inCollege: true })).toBe(true);
    });
});

describe('maintenance gate', () => {
    const req = (url: string, token?: string) => ({ originalUrl: url, headers: token ? { authorization: `Bearer ${token}` } : {} });
    it('lets everything through when maintenance is off', async () => {
        expect((await run(maintenanceGate, req('/api/problems'))).next).toBe(true);
    });
    it('refuses learners with 503 and the message while on', async () => {
        state.maintenance = true;
        mockQuery.mockResolvedValue({ rows: [{ role: 'user' }] });
        const r = await run(maintenanceGate, req('/api/problems', 'learner-token'));
        expect(r.status).toBe(503);
        expect(r.body.error).toEqual({ code: 'MAINTENANCE', message: 'Back soon' });
        expect((await run(maintenanceGate, req('/api/courses'))).status).toBe(503);
    });
    it('keeps staff, sign-in, status, admin and webhooks working', async () => {
        state.maintenance = true;
        mockQuery.mockResolvedValue({ rows: [{ role: 'super_admin' }] });
        expect((await run(maintenanceGate, req('/api/problems', 'admin-token'))).next).toBe(true);
        for (const url of ['/api/health', '/api/system/status', '/api/auth/signin', '/api/admin/users', '/api/v2/payments/webhook',
            '/api/payments/webhook', '/api/v1/apprenticeship/webhooks/github', '/api/whatsapp/webhook']) {
            expect((await run(maintenanceGate, req(url))).next).toBe(true);
        }
    });
    it('never blocks when the state cannot be read', async () => {
        (ControlCentre.state as jest.Mock).mockRejectedValue(new Error('db down'));
        expect((await run(maintenanceGate, req('/api/problems'))).next).toBe(true);
    });
});

describe('kill switches and sign-ups', () => {
    it('refuses a switched-off module, except its open paths', async () => {
        jest.spyOn(ControlCentre, 'moduleOn').mockResolvedValue(false);
        const gate = moduleGate('module.payments', [/^\/verify$/]);
        const off = await run(gate, { path: '/create-order' });
        expect(off.status).toBe(503);
        expect(off.body.error.code).toBe('MODULE_DISABLED');
        expect((await run(gate, { path: '/verify' })).next).toBe(true);
    });
    it('passes a module that is on', async () => {
        jest.spyOn(ControlCentre, 'moduleOn').mockResolvedValue(true);
        expect((await run(moduleGate('module.ai'), { path: '/chat' })).next).toBe(true);
    });
    it('moduleOn: unknown modules and release flags never switch anything off', async () => {
        jest.restoreAllMocks();
        jest.spyOn(ControlCentre, 'state').mockResolvedValue({ ...state, flags: [flag({ key: 'module.ai', kind: 'kill_switch', enabled: false })] } as any);
        expect(await ControlCentre.moduleOn('module.ai')).toBe(false);
        expect(await ControlCentre.moduleOn('module.unknown')).toBe(true);
    });
    it('closes sign-ups', async () => {
        state.signupsOpen = false;
        const r = await run(signupGate, {});
        expect(r.status).toBe(403);
        expect(r.body.error.code).toBe('SIGNUPS_CLOSED');
        state.signupsOpen = true;
        expect((await run(signupGate, {})).next).toBe(true);
    });
});

describe('secrets', () => {
    it('never returns a key, only a mask with its last four characters', () => {
        expect(maskSecret('sk-or-v1-abcdef123456')).toBe(`${MASK}3456`);
        expect(maskSecret('')).toBe('');
        expect(maskSettings({ ai_openai_key: 'sk-1234567890', ai_model: 'gpt', stripe_secret: 'x' }))
            .toEqual({ ai_openai_key: `${MASK}7890`, ai_model: 'gpt', stripe_secret: MASK });
        expect(isMasked(`${MASK}7890`)).toBe(true);
        expect(isMasked('sk-new-key')).toBe(false);
    });
    it('says where a provider key comes from', () => {
        expect(keyStatus('', 'env-key-123456')).toEqual({ configured: true, source: 'server', hint: `${MASK}3456` });
        expect(keyStatus('', undefined)).toEqual({ configured: false, source: null, hint: '' });
        expect(keyStatus('stored-key-9999', 'env')).toMatchObject({ source: 'admin' });
    });
});

describe('CSV export', () => {
    it('quotes, escapes and neutralises spreadsheet formulas', () => {
        expect(csvCell('plain')).toBe('plain');
        expect(csvCell('a,b')).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
        expect(csvCell(null)).toBe('');
        expect(csvCell(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02T00:00:00.000Z');
    });
});
