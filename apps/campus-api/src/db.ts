// Two ways to touch the database, and the rule for choosing:
//
//   asUser(userId, fn)  — runs as Postgres role `authenticated` with the
//                         caller's JWT claims, so RLS decides every row.
//                         Use for ANY read or write a user asks for.
//   asSystem(fn)        — runs as the connection owner (bypasses RLS).
//                         Use only AFTER asUser has proven access, for data
//                         RLS deliberately hides from learners (questions with
//                         answers, attempt writes) — always by explicit ids.

import { Pool, PoolClient } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.PG_POOL_MAX,
  ssl: env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => console.error('Idle Postgres client error:', err.message));

export type Db = PoolClient;

async function inTransaction<T>(setup: (c: PoolClient) => Promise<unknown>, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("set local statement_timeout = '15s'");
    await setup(client);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function asUser<T>(userId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return inTransaction(async (c) => {
    // set_config(..., true) and SET LOCAL both end with the transaction, so a
    // pooled connection never carries one user's identity into the next request.
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await c.query('set local role authenticated');
  }, fn);
}

export function asSystem<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return inTransaction(async () => undefined, fn);
}
