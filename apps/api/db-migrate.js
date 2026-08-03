const { Pool } = require('pg');
require('dotenv').config({ path: 'apps/api/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await pool.query('ALTER TABLE courses ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;');
    console.log('Successfully added order_index to courses table');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}
run();
