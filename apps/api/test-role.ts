import { supabase } from './src/config/database';

async function main() {
    const { data: user, error: userError } = await supabase.rpc('get_my_role'); // Wait, rpc might not exist
    
    // Instead, let's just insert something and see the error, or select from a secure table
    const { data, error } = await supabase.from('content_import_batches').select('*').limit(1);
    console.log('Select:', { data, error });

    // Test inserting a batch to see if RLS blocks it
    const { data: insData, error: insErr } = await supabase.from('content_import_batches').insert({
        content_type: 'problems',
        source: 'upload',
        status: 'pending'
    }).select('id');
    console.log('Insert:', { insData, insErr });
}

main().catch(console.error);
