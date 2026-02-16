const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:adminDSAOSsupabase@db.wxrxnqhjkwlxvmaopvlv.supabase.co:5432/postgres';

async function runMigration() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const sqlPath = path.join(__dirname, 'migrations.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration completed successfully');

    } catch (err) {
        console.error('Migration error', err);
    } finally {
        await client.end();
    }
}

runMigration();
