import { pool } from './src/config/database';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Creating user_referral_codes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_referral_codes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          code VARCHAR(50) NOT NULL UNIQUE,
          reward_amount INTEGER NOT NULL DEFAULT 10000,
          commission_percentage INTEGER DEFAULT NULL,
          is_primary BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Creating analytics_events table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.analytics_events (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tracking_id VARCHAR(100),
          user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          event_type VARCHAR(50) NOT NULL,
          path VARCHAR(255),
          action_name VARCHAR(100),
          metadata JSONB,
          error_message TEXT,
          error_stack TEXT,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Adding columns to referrals table...');
    await client.query(`
      ALTER TABLE public.referrals 
      ADD COLUMN IF NOT EXISTS referral_code_used VARCHAR(50),
      ADD COLUMN IF NOT EXISTS expected_reward_amount INTEGER;
    `);
    
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
