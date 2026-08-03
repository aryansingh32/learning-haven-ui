import { supabase } from '../src/config/database';

async function test() {
  const { data, error } = await supabase
    .from('build_enrollments')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      program_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      language: 'python'
    })
    .select();

  console.log('Error:', error);
  console.log('Data:', data);
}

test();
