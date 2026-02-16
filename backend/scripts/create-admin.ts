
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const adminEmail = 'admin@example.com'; // Using the one verified in browser test
const adminPassword = 'password123';

async function createAdmin() {
    console.log(`Attempting to create/update admin user: ${adminEmail}`);

    // 1. Check if user already exists in Auth
    // Note: listUsers is an admin function.
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    let userId = users.find(u => u.email === adminEmail)?.id;

    if (!userId) {
        console.log('User not found in Auth, creating...');
        const { data, error: createError } = await supabase.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { full_name: 'Super Admin' }
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return;
        }
        userId = data.user.id;
        console.log('User created in Auth:', userId);
    } else {
        console.log('User already exists in Auth:', userId);
        // Optionally update password if needed, but skipping for now
    }

    // 2. Upsert into public.users with super_admin role
    console.log('Upserting into public.users...');
    const { error: upsertError } = await supabase
        .from('users')
        .upsert({
            id: userId,
            email: adminEmail,
            full_name: 'Super Admin',
            role: 'super_admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (upsertError) {
        console.error('Error upserting into public.users:', upsertError);
        return;
    }

    console.log('Successfully configured admin user!');
}

createAdmin().catch(console.error);
