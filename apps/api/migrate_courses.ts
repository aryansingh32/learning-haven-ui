import { pool } from './src/config/database';

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Renaming tables and columns...');

        // 1. Rename tables
        await client.query(`ALTER TABLE IF EXISTS public.roadmaps RENAME TO courses;`);
        await client.query(`ALTER TABLE IF EXISTS public.roadmap_items RENAME TO course_items;`);

        // 2. Rename constraints/indexes (best effort, ignore errors if names don't match)
        try { await client.query(`ALTER INDEX IF EXISTS roadmaps_pkey RENAME TO courses_pkey;`); } catch {}
        try { await client.query(`ALTER INDEX IF EXISTS roadmap_items_pkey RENAME TO course_items_pkey;`); } catch {}

        // 3. Rename columns in course_items
        await client.query(`ALTER TABLE IF EXISTS public.course_items RENAME COLUMN roadmap_id TO course_id;`);

        // 4. Rename columns in chapters
        await client.query(`ALTER TABLE IF EXISTS public.chapters RENAME COLUMN roadmap_id TO course_id;`);
        
        // Update foreign key constraint in chapters if we know the name, otherwise it auto-updates the reference.
        // The foreign key itself points to the new table automatically in Postgres, but the constraint name remains old.
        // We can just leave the constraint name as is, it doesn't hurt.

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
