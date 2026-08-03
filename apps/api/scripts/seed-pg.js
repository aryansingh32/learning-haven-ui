
const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function seed() {
    await client.connect();

    const userId = '12345678-1234-1234-1234-123456789012'; // Must match token
    const email = 'admin@bypass.com';

    try {
        console.log('Inserting into auth.users...');
        // We need to be careful with constraints. simplistic insert.
        // Password hash is fake, we wont use it for login (we use token bypass), 
        // but auth.users might need it.
        await client.query(`
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, 'fakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '')
      ON CONFLICT (id) DO NOTHING;
    `, [userId, email]);

        console.log('Inserting into public.users...');
        await client.query(`
      INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
      VALUES ($1, $2, 'Super Admin (Bypass)', 'super_admin', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
    `, [userId, email]);

        console.log('Seed successful!');
    } catch (err) {
        console.error('Seed failed:', err);
    } finally {
        await client.end();
    }
}

seed();
