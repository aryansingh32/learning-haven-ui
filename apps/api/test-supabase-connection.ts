import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key (prefix):', supabaseKey?.substring(0, 5) + '...');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Starting health check query...');
    const start = Date.now();
    try {
        // Simple query to public.users or any table
        const { data, error } = await supabase.from('roadmaps').select('count').limit(1);
        const duration = Date.now() - start;
        
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Success! Data:', data);
            console.log(`Query took ${duration}ms`);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
    process.exit(0);
}

test();
