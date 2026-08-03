
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upsertUser() {
    const userId = '12345678-1234-1234-1234-123456789012'; // Must match token
    const adminEmail = 'admin@bypass.com';

    console.log('Upserting user into public.users...', userId);

    const { error } = await supabase
        .from('users')
        .upsert({
            id: userId,
            email: adminEmail,
            full_name: 'Super Admin (Bypass)',
            role: 'super_admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (error) {
        console.error('Error upserting user:', error);
    } else {
        console.log('User upserted successfully!');
    }
}

upsertUser();
