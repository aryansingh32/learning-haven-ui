import { supabase } from './src/config/database';

async function main() {
    console.log('Testing Supabase Client Role and Inserts...');
    
    const adminId = '266df405-1bcd-40f1-b51d-c5e96d4e7726'; // From user request logs

    console.log('1. Inserting into content_import_batches...');
    const { data: batch, error: batchErr } = await supabase
        .from('content_import_batches')
        .insert({
            content_type: 'problems',
            source: 'upload',
            source_ref: 'test.csv',
            uploaded_by: adminId,
            status: 'pending',
            total_rows: 1,
            valid_rows: 1,
            error_rows: 0,
        })
        .select('id')
        .single();
    
    console.log('Batch Insert Result:', { batch, batchErr });

    if (!batchErr && batch) {
        console.log('2. Inserting into content_import_rows...');
        const { data: row, error: rowErr } = await supabase
            .from('content_import_rows')
            .insert({
                batch_id: batch.id,
                row_number: 1,
                raw_data: {},
                status: 'valid',
                errors: [],
            })
            .select('id');
        
        console.log('Row Insert Result:', { row, rowErr });
        
        console.log('3. Cleanup...');
        await supabase.from('content_import_batches').delete().eq('id', batch.id);
    }
}

main().catch(console.error);
