import { pool, supabase } from './src/config/database';
import { CoursesService } from './src/modules/learning/services/courses.service';

async function run() {
  const { data: user } = await supabase.from('users').select('id').limit(1).single();
  const userId = user.id;

  const { data: enrolls } = await supabase.from('course_enrollments').select('*').eq('user_id', userId);
  console.log('Enrollments before:', enrolls);

  if (enrolls.length > 0) {
     const courseId = enrolls[0].course_id;
     await CoursesService.updateCourseProgress(userId, courseId);
     const { data: updated } = await supabase.from('course_enrollments').select('*').eq('id', enrolls[0].id);
     console.log('Enrollment after:', updated);
  }
  
  await pool.end();
  process.exit(0);
}
run();
