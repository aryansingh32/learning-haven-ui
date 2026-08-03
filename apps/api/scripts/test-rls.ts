import { supabase } from '../src/config/database';

async function test() {
  const { data, error } = await supabase.from('build_enrollments').select('id');
  console.log('Error:', error);
  console.log('Enrollments count:', data?.length);
}

test();
