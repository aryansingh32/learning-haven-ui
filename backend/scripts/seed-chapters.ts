import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ChapterSchema = z.object({
  roadmap_slug: z.string(),
  chapter_number: z.number(),
  title: z.string(),
  topic_tag: z.string().optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  est_minutes: z.number().optional(),
  story_hook: z.string().optional(),
  whatsapp_msg: z.string().optional(),
  video: z.object({
    youtube_id: z.string(),
    channel: z.string().optional(),
    title: z.string().optional(),
    duration_min: z.number().optional(),
    timestamps: z.array(z.object({
      label: z.string(),
      seconds: z.number()
    })).optional()
  }).optional(),
  article: z.object({
    url: z.string(),
    source: z.string().optional(),
    title: z.string().optional()
  }).optional(),
  problems: z.array(z.any()).optional(),
  quiz: z.array(z.any()).optional(),
  tasks: z.array(z.any()).optional()
});

async function runSeeder() {
  const chaptersDir = path.resolve(__dirname, '../data/chapters');

  if (!fs.existsSync(chaptersDir)) {
    console.error(`Directory not found: ${chaptersDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.json'));

  let seededCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  console.log(`Found ${files.length} JSON files. Beginning ingestion...`);

  for (const file of files) {
    const filePath = path.join(chaptersDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      const chapter = ChapterSchema.parse(data);

      // a. Find roadmap by slug
      const { data: roadmap, error: roadmapErr } = await supabase
        .from('roadmaps')
        .select('id')
        .eq('slug', chapter.roadmap_slug)
        .single();

      if (roadmapErr || !roadmap) {
        console.warn(`[WARNING] File ${file}: Roadmap not found with slug: ${chapter.roadmap_slug}. Skipping.`);
        warningCount++;
        continue;
      }

      // b. Upsert chapter (match on roadmap_id, chapter_number)
      // Note: Since Postgres doesn't strictly upsert without knowing the internal conflict target naturally if we dont specify it correctly, 
      // Supabase allows onConflict. However, we have a UNIQUE(roadmap_id, chapter_number) constraint.
      const { data: upsertedChapter, error: chapterErr } = await supabase
        .from('chapters')
        .upsert({
          roadmap_id: roadmap.id,
          chapter_number: chapter.chapter_number,
          title: chapter.title,
          topic_tag: chapter.topic_tag,
          difficulty: chapter.difficulty,
          story_hook: chapter.story_hook,
          whatsapp_msg: chapter.whatsapp_msg,
          est_minutes: chapter.est_minutes
        }, { onConflict: 'roadmap_id,chapter_number' })
        .select('id')
        .single();

      if (chapterErr || !upsertedChapter) {
        console.error(`[ERROR] File ${file}: Failed to upsert chapter - ${chapterErr?.message}`);
        errorCount++;
        continue;
      }

      // c. Upsert chapter_content
      const contentPayload = {
        chapter_id: upsertedChapter.id,
        video_youtube_id: chapter.video?.youtube_id || null,
        video_channel: chapter.video?.channel || null,
        video_title: chapter.video?.title || null,
        video_duration: chapter.video?.duration_min || null,
        video_timestamps: chapter.video?.timestamps || [],
        article_url: chapter.article?.url || null,
        article_source: chapter.article?.source || null,
        article_title: chapter.article?.title || null,
        problems: chapter.problems || [],
        quiz: chapter.quiz || [],
        tasks: chapter.tasks || [],
      };

      const { error: contentErr } = await supabase
        .from('chapter_content')
        .upsert(contentPayload, { onConflict: 'chapter_id' });

      if (contentErr) {
        console.error(`[ERROR] File ${file}: Failed to upsert content - ${contentErr.message}`);
        errorCount++;
        continue;
      }

      // d. Log Success
      console.log(`Chapter ${chapter.chapter_number}: ${chapter.title} — ✓ seeded`);
      seededCount++;

    } catch (err: any) {
      console.error(`[ERROR] File ${file}: ${err.message || 'Unknown error during ingestion'}`);
      errorCount++;
    }
  }

  console.log(`\nDONE: ${seededCount} chapters seeded, ${warningCount} warnings, ${errorCount} errors`);
}

runSeeder();
