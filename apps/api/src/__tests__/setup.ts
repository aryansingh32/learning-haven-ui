/**
 * Test setup — runs before each test file.
 *
 * Mocks external services so tests never make real API calls.
 * Provides helpers for creating test users and tokens.
 */

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'test-razorpay-key';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test-razorpay-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters';
process.env.GITHUB_TOKEN_ENCRYPTION_KEY =
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY || 'test-github-token-key-minimum-32-chars';

// Mock ESM-only packages that Jest can't transform
jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-0000-0000-000000000099'),
}));

// Mock ws (used by supabase realtime)
jest.mock('ws', () => jest.fn());

// Mock @octokit/rest to avoid ESM issues
jest.mock('@octokit/rest', () => ({
  Octokit: class {
    repos = {
      get: jest.fn().mockResolvedValue({ data: {} }),
      createFork: jest.fn().mockResolvedValue({ data: {} }),
    };
    pulls = {
      create: jest.fn().mockResolvedValue({ data: {} }),
      get: jest.fn().mockResolvedValue({ data: {} }),
    };
  },
}));

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  const limiter = jest.fn().mockReturnValue((req: any, res: any, next: any) => next());
  (limiter as any).ipKeyGenerator = jest.fn((ip: string) => ip);
  return limiter;
});
jest.mock('rate-limit-redis', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// ── Mock external services ──────────────────────────────

// Mock Razorpay
jest.mock('../config/razorpay', () => ({
  __esModule: true,
  default: {
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test_123',
        amount: 49900,
        currency: 'INR',
        status: 'created',
      }),
    },
  },
  verifyPaymentSignature: jest.fn().mockReturnValue(true),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
}));

// Mock Redis
jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(0),
    call: jest.fn().mockResolvedValue(null),
    sendCommand: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
  },
}));

// Mock email service
jest.mock('../modules/communication/services/email.service', () => ({
  sendApprenticeshipWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendProjectPassedEmail: jest.fn().mockResolvedValue(undefined),
}));

// Mock BullMQ workers (prevent them from starting in tests)
jest.mock('../workers/email.worker', () => ({ __esModule: true }));
jest.mock('../workers/verification.worker', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../workers/build-verification.worker', () => ({
  __esModule: true,
}));

// Mock OpenAI
jest.mock('../config/openai', () => ({
  __esModule: true,
  default: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI response' } }],
        }),
      },
    },
  },
  AI_MODEL: 'gpt-4o-mini',
  SYSTEM_PROMPT: 'Test system prompt',
}));

// Mock winston logger to reduce noise in tests
jest.mock('../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn((...args) => console.error(...args)),
    debug: jest.fn(),
  },
}));

// Mock requestTracer
jest.mock('../middleware/requestTracer', () => ({
  requestTracer: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requestContext: {
    getStore: jest.fn().mockReturnValue(null),
    run: jest.fn((_store: unknown, callback: () => unknown) => callback()),
  },
}));

// Mock verification service bootstrap
jest.mock('../modules/execution/services/verification.service', () => ({
  VerificationService: {
    bootstrap: jest.fn(),
  },
}));

// ── Test helpers ────────────────────────────────────────

export const TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'testuser@learninghaven.dev',
  role: 'user',
  full_name: 'Test User',
};

export const TEST_ADMIN = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'admin@learninghaven.dev',
  role: 'admin',
  full_name: 'Test Admin',
};

export const TEST_SUPER_ADMIN = {
  id: '00000000-0000-0000-0000-000000000003',
  email: 'superadmin@learninghaven.dev',
  role: 'super_admin',
  full_name: 'Test Super Admin',
};

/**
 * Generate a mock JWT token string.
 * Our tests mock the auth middleware, so this just needs to be non-empty.
 */
export function getAuthToken(userId = TEST_USER.id): string {
  return `test-token-${userId}`;
}

/**
 * Creates a supertest-compatible auth header object.
 */
export function authHeaders(userId = TEST_USER.id): Record<string, string> {
  return {
    Authorization: `Bearer ${getAuthToken(userId)}`,
  };
}
