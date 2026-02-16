
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listUsers() {
    console.log('Listing public.users...');
    const { data, error } = await supabase
        .from('users')
        .select('id, email, role')
        .limit(5);

    if (error) {
        console.error('Error listing users:', error);
    } else {
        console.log('Users found:', data);
    }
}

listUsers();
