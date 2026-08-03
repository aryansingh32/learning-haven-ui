
const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function updateRole() {
    const email = 'admin12@gmail.com';

    try {
        await client.connect();
        console.log('Connected to database...');

        console.log(`Updating role for ${email} to 'admin'...`);
        const res = await client.query(`
      UPDATE public.users 
      SET role = 'admin' 
      WHERE email = $1
    `, [email]);

        console.log(`Updated ${res.rowCount} row(s).`);

    } catch (err) {
        console.error('Error updating role:', err);
    } finally {
        await client.end();
    }
}

updateRole();
