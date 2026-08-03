/**
 * Auth endpoint tests
 *
 * Tests signup, signin, refresh, signout flows.
 * External services (Supabase Auth) are mocked via the setup.
 */
import request from 'supertest';

// Mock the database module BEFORE importing app
const mockSupabaseAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
  signOut: jest.fn(),
  getUser: jest.fn(),
};

const mockSupabaseFrom = jest.fn().mockReturnValue({
  insert: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    }),
  }),
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
  update: jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
});

jest.mock('../config/database', () => ({
  supabase: {
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
    channel: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue(undefined),
    }),
  },
  pool: {
    connect: jest.fn(),
    on: jest.fn(),
  },
}));

import app from '../app';

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────────────
  // POST /api/auth/signup
  // ────────────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'new@example.com',
      };
      mockSupabaseAuth.signUp.mockResolvedValueOnce({
        data: { user: mockUser, session: { access_token: 'tok' } },
        error: null,
      });
      mockSupabaseFrom.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [mockUser], error: null }),
        }),
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'new@example.com',
          password: 'StrongP@ss1',
          full_name: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
    });

    it('should return 422 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE');
    });

    it('should return 422 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'StrongP@ss1',
          full_name: 'Test',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: '123', // too short
          full_name: 'Test',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for duplicate email from Supabase', async () => {
      mockSupabaseAuth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'StrongP@ss1',
          full_name: 'Existing User',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/auth/signin
  // ────────────────────────────────────────────────────
  describe('POST /api/auth/signin', () => {
    it('should sign in successfully', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: 'tok', refresh_token: 'ref' },
          user: { id: 'user-1', email: 'test@example.com' },
        },
        error: null,
      });

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'StrongP@ss1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      });

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'WrongPass' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/auth/refresh
  // ────────────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('should refresh a valid token', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'new-tok',
            refresh_token: 'new-ref',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
          },
        },
        error: null,
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.access_token).toBe('new-tok');
    });

    it('should return 401 for expired token', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'Token expired' },
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'expired-token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for missing refresh_token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/auth/signout
  // ────────────────────────────────────────────────────
  describe('POST /api/auth/signout', () => {
    it('should sign out successfully', async () => {
      mockSupabaseAuth.signOut.mockResolvedValueOnce({ error: null });

      const res = await request(app)
        .post('/api/auth/signout')
        .set('Authorization', 'Bearer some-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when no token provided', async () => {
      const res = await request(app)
        .post('/api/auth/signout');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
