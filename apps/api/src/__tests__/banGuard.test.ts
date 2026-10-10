/**
 * Suspended accounts: the ban lookup, and the auth middleware refusing them.
 */
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({ pool: { query: (...a: unknown[]) => mockQuery(...a) }, supabase: {} }));
jest.mock('../utils/supabaseJwt', () => ({
  verifySupabaseAccessToken: (t: string) => (t ? { id: t, email: `${t}@x.test`, role: 'authenticated', claims: {} } : null),
}));
jest.mock('../modules/auth/services/sessionGuard', () => ({ isSessionRevoked: async () => false, firstSighting: () => false }));

const actual = jest.requireActual('../modules/auth/services/banGuard');

describe('ban guard', () => {
  beforeEach(() => mockQuery.mockReset());

  it('reads the ban once and caches it', async () => {
    mockQuery.mockResolvedValue({ rows: [{ is_banned: true }] });
    expect(await actual.isBanned('b1')).toBe(true);
    expect(await actual.isBanned('b1')).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('a restore applies at once after forgetBans', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ is_banned: true }] }).mockResolvedValueOnce({ rows: [{ is_banned: false }] });
    expect(await actual.isBanned('b2')).toBe(true);
    actual.forgetBans(['b2']);
    expect(await actual.isBanned('b2')).toBe(false);
  });

  it('lets the request through if the lookup fails', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    expect(await actual.isBanned('b3')).toBe(false);
  });
});

describe('auth middleware', () => {
  const { isBanned } = jest.requireMock('../modules/auth/services/banGuard');
  const { authenticateUser, optionalAuth } = require('../middleware/auth');
  const call = (mw: any, token: string) => new Promise<{ status: number; body: any; user?: any }>((resolve) => {
    const req: any = { headers: { authorization: `Bearer ${token}` }, get: () => undefined };
    const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(b: any) { resolve({ status: this.statusCode, body: b }); return this; } };
    mw(req, res, () => resolve({ status: 200, body: null, user: req.user }));
  });

  it('refuses a suspended account with ACCOUNT_SUSPENDED', async () => {
    (isBanned as jest.Mock).mockResolvedValueOnce(true);
    const r = await call(authenticateUser, 'banned-user');
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('lets an ordinary account through', async () => {
    (isBanned as jest.Mock).mockResolvedValueOnce(false);
    const r = await call(authenticateUser, 'fine-user');
    expect(r.user?.id).toBe('fine-user');
  });

  it('optional auth treats a suspended account as signed out', async () => {
    (isBanned as jest.Mock).mockResolvedValueOnce(true);
    const r = await call(optionalAuth, 'banned-user');
    expect(r.status).toBe(200);
    expect(r.user).toBeUndefined();
  });
});
