/**
 * requireAdmin middleware tests
 *
 * Verifies that:
 * 1. An arbitrary / unknown user id does NOT get super_admin (backdoor removed).
 * 2. A user with 'admin' role passes.
 * 3. A user with 'super_admin' role passes.
 * 4. A user with 'user' role is rejected with 403.
 * 5. An unauthenticated request is rejected with 401.
 */

import { requireAdmin, requireSuperAdmin } from '../middleware/requireAdmin';
import { supabase } from '../config/database';

// Mock supabase
jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
  pool: {
    query: jest.fn(),
  },
}));

const mockSupabaseFrom = supabase.from as jest.Mock;

function makeReq(userId?: string) {
  return { user: userId ? { id: userId } : undefined } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockUserRole(role: string | null) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(
      role
        ? { data: { role }, error: null }
        : { data: null, error: { code: 'PGRST116' } }
    ),
  };
  mockSupabaseFrom.mockReturnValue(query);
}

describe('requireAdmin middleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated request with 401', async () => {
    const req = makeReq(undefined);
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('grants access to admin role', async () => {
    mockUserRole('admin');
    const req = makeReq('00000000-0000-0000-0000-000000000002');
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('grants access to super_admin role', async () => {
    mockUserRole('super_admin');
    const req = makeReq('00000000-0000-0000-0000-000000000003');
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects user role with 403', async () => {
    mockUserRole('user');
    const req = makeReq('00000000-0000-0000-0000-000000000001');
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * SECURITY: Confirm that the old hardcoded bypass UUID does NOT receive
   * super_admin privileges after the backdoor was removed.
   * This UUID was formerly hardcoded in requireAdmin.ts and would have
   * short-circuited all role checks.
   */
  it('does NOT grant super_admin to the former bypass UUID', async () => {
    // Simulate what the DB returns for this UUID — either null/error (user doesn't
    // exist) or a normal 'user' role. Either way, it must NOT be treated as super_admin.
    mockUserRole(null); // user not found in DB
    const bypassUuid = '12345678-1234-1234-1234-123456789012';
    const req = makeReq(bypassUuid);
    const res = makeRes();
    await requireAdmin(req, res, next);
    // Should be rejected — 403 (no role found → null → access denied)
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireSuperAdmin middleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants access to super_admin role', async () => {
    mockUserRole('super_admin');
    const req = makeReq('00000000-0000-0000-0000-000000000003');
    const res = makeRes();
    await requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects admin (non super_admin) with 403', async () => {
    mockUserRole('admin');
    const req = makeReq('00000000-0000-0000-0000-000000000002');
    const res = makeRes();
    await requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('does NOT grant super_admin to the former bypass UUID', async () => {
    mockUserRole(null);
    const bypassUuid = '12345678-1234-1234-1234-123456789012';
    const req = makeReq(bypassUuid);
    const res = makeRes();
    await requireSuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
