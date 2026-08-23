import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { env } from './env';

const supabaseUrl = env.SUPABASE_URL;
const databaseUrl = env.DATABASE_URL;

import ws from 'ws';

/**
 * Standard Supabase client — uses ANON key so that Row Level Security (RLS)
 * policies are respected. This client represents the "logged-out" / service
 * perspective and should NOT bypass RLS.
 *
 * For auth token-scoped operations, use supabase.auth.setSession() or pass the
 * token via the Authorization header at the HTTP level.
 */
export const supabase = createClient(supabaseUrl, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: fetch,
  },
  realtime: {
    transport: ws,
  },
});

/**
 * Admin Supabase client — uses SERVICE_ROLE key which bypasses RLS.
 * Use ONLY for legitimate admin-level operations:
 *   - Reading auth.users during profile auto-create (users.service.ts)
 *   - Admin panel data operations
 *   - Background jobs that need cross-user access
 *
 * Never use this for user-facing data reads.
 */
export const supabaseAdmin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: fetch,
  },
  realtime: {
    transport: ws,
  },
});

export const pool = new Pool({
    connectionString: databaseUrl,
    max: env.PG_POOL_MAX,
    idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.PG_CONNECTION_TIMEOUT_MS,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

