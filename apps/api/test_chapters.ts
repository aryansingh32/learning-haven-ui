import { pool } from './src/config/database';

async function run() {
  const courseId = '19c2a5f9-07a2-4338-b425-a052bc61a3ff';
  const chaptersResult = await pool.query(
      'SELECT * FROM public.chapters WHERE course_id = $1 ORDER BY chapter_number ASC',
      [courseId]
  );
  console.log('Chapters found:', chaptersResult.rows.length);
  if (chaptersResult.rows.length > 0) {
      console.log('First chapter:', chaptersResult.rows[0]);
  }
  process.exit(0);
}
run();
