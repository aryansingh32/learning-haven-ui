import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a URL'),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5175'),
  PG_POOL_MAX: z.coerce.number().default(10),
  // Code judge for coding questions (self-hosted Judge0 CE). Without
  // JUDGE0_URL, development runs code locally; production marks coding
  // answers "grading pending" until a judge is configured and staff regrade.
  JUDGE0_URL: z.string().url().optional(),
  JUDGE0_AUTH_TOKEN: z.string().min(1).optional(),
  JUDGE0_JS_LANGUAGE_ID: z.coerce.number().default(63),
  JUDGE0_PYTHON_LANGUAGE_ID: z.coerce.number().default(71),
  JUDGE0_JAVA_LANGUAGE_ID: z.coerce.number().default(62),
  JUDGE0_CPP_LANGUAGE_ID: z.coerce.number().default(54),
  JUDGE0_TIMEOUT_MS: z.coerce.number().default(20_000),
  // Notifications: reminders run when something calls POST /campus/internal/scheduler
  // with x-cron-secret (or every SCHEDULER_MINUTES inside the server). Email goes
  // out through Resend when RESEND_API_KEY is set; without it, notifications are in-app only.
  CRON_SECRET: z.string().min(16).optional(),
  SCHEDULER_MINUTES: z.coerce.number().int().min(1).max(1440).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().default('Forge Campus <noreply@forge.dev>'),
  APP_URL: z.string().url().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid Campus API configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
