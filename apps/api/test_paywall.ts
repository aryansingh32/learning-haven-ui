import { pool } from './src/config/database';
import { supabase } from './src/config/supabase';
import { ChaptersService } from './src/modules/learning/services/chapters.service';

async function run() {
  const courseId = '19c2a5f9-07a2-4338-b425-a052bc61a3ff'; // DSA Foundations
  const { data: users } = await supabase.from('users').select('id, current_plan').limit(1);
  const user = users?.[0];
  if (!user) {
      console.log('No user found');
      process.exit(0);
  }
  console.log('Testing with user:', user);
  
  try {
      const chapters = await ChaptersService.getCourseChaptersForUser(user.id, courseId);
      console.log(`Found ${chapters.length} chapters for the user`);
      chapters.forEach(c => console.log(`Chapter ${c.chapter_number}: ${c.status}`));
  } catch(e) {
      console.error(e);
  } finally {
      await pool.end();
      process.exit(0);
  }
}
run();
