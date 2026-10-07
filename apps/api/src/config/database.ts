import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { env } from './env';

const supabaseUrl = env.SUPABASE_URL;
const databaseUrl = env.DATABASE_URL;

import ws from 'ws';

/**
 * Server-side data client. This is trusted server code: routes enforce auth
 * and ownership themselves, and the pg pool below already connects with full
 * database rights. It uses the SERVICE_ROLE key so that the public anon key
 * (shipped inside the web app) can be locked out of every table by RLS.
 *
 * Never call session-changing auth methods (signIn*, signUp, refreshSession,
 * signOut) on this shared client — supabase-js keeps that session in memory
 * and would run later queries as that user. Use createAuthClient() instead.
 */
export const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
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

/**
 * A fresh, throwaway client for one auth flow (sign in, sign up, refresh).
 * Nothing it learns about a session is shared with other requests.
 */
export function createAuthClient() {
  return createClient(supabaseUrl, env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
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
}

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
