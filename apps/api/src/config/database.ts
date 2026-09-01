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
    // Keep TCP connections alive so the remote Supabase postgres doesn't silently
    // drop idle connections, which causes "Connection terminated" errors.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: databaseUrl?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

// Cap per-query execution time at 15s to ensure pool connections are
// released promptly even when a query hangs (e.g. due to Supabase throttling).
pool.on('connect', (client) => {
    client.query("SET statement_timeout = '15000'").catch(() => {
        // Non-fatal: if SET fails, the pool still works fine
    });
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle pg pool client:', err.message);
});
