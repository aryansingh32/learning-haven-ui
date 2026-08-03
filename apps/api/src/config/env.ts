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
