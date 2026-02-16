const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

async function updateUserRole(email, newRole) {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log(`Connected to database for updating ${email}...`);

        const res = await client.query(
            'UPDATE public.users SET role = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, role',
            [newRole, email]
        );

        if (res.rowCount === 0) {
            console.error(`User with email ${email} not found in public.users.`);
        } else {
            console.log('Update successful:', res.rows[0]);
        }
    } catch (err) {
        console.error('Error updating role:', err.stack);
    } finally {
        await client.end();
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node update-user-role.js <email> <role>');
    process.exit(1);
}

updateUserRole(args[0], args[1]);
