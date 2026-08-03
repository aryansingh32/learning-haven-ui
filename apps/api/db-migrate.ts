import { pool } from './src/config/database';
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
