import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { env } from './env';

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
const databaseUrl = env.DATABASE_URL;

import ws from 'ws';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: fetch
  },
  realtime: {
    transport: ws
  }
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
