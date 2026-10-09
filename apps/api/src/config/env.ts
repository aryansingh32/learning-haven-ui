import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env before parsing
dotenv.config({ quiet: true });

/**
 * Centralized environment variable validation.
 *
 * Imported as the very first module in server.ts so that the process
 * crashes immediately on startup if any required variable is missing
 * or malformed — not mid-request in production.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().default(5000),

  // ── Supabase ──────────────────────────────────────────────
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // ── Database ──────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Redis ─────────────────────────────────────────────────
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().default(5_000),

  // ── AI / LLM ──────────────────────────────────────────────
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().optional(),

  // ── Razorpay ──────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Seller details printed on GST invoices (not secret). Invoices are issued only when these are set.
  SELLER_LEGAL_NAME: z.string().min(1).optional(),
  SELLER_GSTIN: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'SELLER_GSTIN is not a valid GSTIN').optional(),
  SELLER_ADDRESS: z.string().min(1).optional(),

  // ── Email ─────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1).optional(),

  // ── GitHub ────────────────────────────────────────────────
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_BOT_TOKEN: z.string().min(1).optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  GITHUB_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, 'GITHUB_TOKEN_ENCRYPTION_KEY must be at least 32 characters'),
  WEBHOOK_BASE_URL: z.string().url().default('https://api.learninghaven.com'),
  GITHUB_OAUTH_CALLBACK_URL: z.string().url().optional(),

  // ── Auth ──────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SUPABASE_AUTH_TIMEOUT_MS: z.coerce.number().default(12_000),

  // ── Frontend ──────────────────────────────────────────────
  FRONTEND_URL: z.string().url().optional(),

  // ── Metrics ───────────────────────────────────────────────
  METRICS_SECRET_TOKEN: z.string().min(1).optional(),
  RATE_LIMIT_REDIS_PREFIX: z.string().default('rate-limit:'),

  // ── Worker ────────────────────────────────────────────────
  WORKER_CONCURRENCY: z.coerce.number().default(10),
  BUILD_WORKER_CONCURRENCY: z.coerce.number().default(5),
  PG_POOL_MAX: z.coerce.number().default(20),
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5_000),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().default(30_000),

  // ── Apprenticeship ────────────────────────────────────────
  APPRENTICESHIP_DISCORD_INVITE: z.string().optional(),

  // ── Code execution (Judge0 sandbox) ───────────────────────
  // Without JUDGE0_URL, development falls back to the local JDK runner;
  // production refuses to run untrusted code at all.
  JUDGE0_URL: z.string().url().optional(),
  JUDGE0_AUTH_TOKEN: z.string().min(1).optional(),
  JUDGE0_JAVA_LANGUAGE_ID: z.coerce.number().default(62),
  // Judge0 CE ids: 63 = JavaScript (Node.js), 71 = Python 3.
  JUDGE0_JS_LANGUAGE_ID: z.coerce.number().default(63),
  JUDGE0_PYTHON_LANGUAGE_ID: z.coerce.number().default(71),
  JUDGE0_CPP_LANGUAGE_ID: z.coerce.number().default(54),
  JUDGE0_TIMEOUT_MS: z.coerce.number().default(20_000),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      '\n╔══════════════════════════════════════════════════════╗\n' +
      '║       FATAL: Environment validation failed          ║\n' +
      '╚══════════════════════════════════════════════════════╝\n\n' +
      formatted +
      '\n\nFix the above issues in your .env file and restart.\n'
    );

    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
