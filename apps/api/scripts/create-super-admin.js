
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function createSuperAdmin() {
    // Never commit credentials: pass them in for one run, e.g.
    //   SUPER_ADMIN_EMAIL=you@org.com SUPER_ADMIN_PASSWORD='…' node scripts/create-super-admin.js
    const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        console.error('Set SUPER_ADMIN_EMAIL to the admin\'s email address.');
        process.exit(1);
    }
    if (password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        console.error('Set SUPER_ADMIN_PASSWORD: at least 14 characters with upper and lower case, a digit and a symbol.');
        process.exit(1);
    }

    try {
        await client.connect();
        console.log('Connected to database...');

        // 1. Check if user exists
        const res = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
        let userId;

        if (res.rows.length > 0) {
            console.log('User already exists in auth.users');
            userId = res.rows[0].id;
        } else {
            console.log('Creating new user in auth.users...');
            userId = uuidv4();
            const encryptedPassword = await bcrypt.hash(password, 10);

            await client.query(`
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password, 
          email_confirmed_at, recovery_sent_at, last_sign_in_at, 
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
          confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
          $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, 
          NOW(), NOW(), NOW(), 
          '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), 
          '', '', '', ''
        )
      `, [userId, email, encryptedPassword]);
        }

        console.log(`User ID: ${userId}`);

        // 2. Insert/Update public.users
        console.log('Upserting into public.users with super_admin role...');
        await client.query(`
      INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
      VALUES ($1, $2, 'Super Admin', 'super_admin', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        role = 'super_admin',
        email = $2
    `, [userId, email]);

        console.log('Super Admin created successfully!');
    } catch (err) {
        console.error('Error creating super admin:', err);
    } finally {
        await client.end();
    }
}

createSuperAdmin();
