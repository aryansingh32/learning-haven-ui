// Runs before any module loads, so env.ts sees test configuration.
const base = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/postgres';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `${base.replace(/\/[^/]*$/, '')}/forge_db_test`;
process.env.SUPABASE_URL = 'http://supabase.test';
process.env.SUPABASE_JWT_SECRET = 'campus-test-secret-not-for-production';
process.env.CORS_ORIGINS = 'http://localhost:5175';
process.env.CRON_SECRET = 'test-cron-secret-0123456789';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.CAMPUS_BASE_DOMAIN = 'forge.test';
