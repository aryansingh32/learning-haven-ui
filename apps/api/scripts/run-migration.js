const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Force IPv4 resolution to prevent ENETUNREACH on IPv6-only hosts
dns.setDefaultResultOrder('ipv4first');

// Path to the .env inside backend/
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        console.error('No DATABASE_URL found in .env');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Supabase DB via pg (IPv4).');

        // Read the SQL file
        const sqlPath = path.resolve(__dirname, '../../backend/supabase/003_new_features.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL migration...');
        const result = await client.query(sql);
        console.log('Migration executed successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
