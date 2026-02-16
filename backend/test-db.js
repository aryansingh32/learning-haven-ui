const { Client } = require('pg');

const connectionString = 'postgresql://postgres:adminDSAOSsupabase@db.wxrxnqhjkwlxvmaopvlv.supabase.co:5432/postgres';

async function testConnection() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected successfully');
        const res = await client.query('SELECT id, email, role FROM public.users');
        console.log('Users:', res.rows);
    } catch (err) {
        console.error('Connection error', err.stack);
    } finally {
        await client.end();
    }
}

testConnection();
