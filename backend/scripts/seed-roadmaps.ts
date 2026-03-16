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

const RoadmapSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
  difficulty_level: z.string().optional(),
  duration_days: z.number().optional(),
  cover_image: z.string().optional(),
  is_premium: z.boolean().optional(),
  is_published: z.boolean().optional(),
  meta: z.any().optional()
});

async function runSeeder() {
  const roadmapsDir = path.resolve(__dirname, '../data/roadmaps');

  if (!fs.existsSync(roadmapsDir)) {
    console.error(`Directory not found: ${roadmapsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(roadmapsDir).filter(f => f.endsWith('.json'));

  let seededCount = 0;
  let errorCount = 0;

  console.log(`Found ${files.length} JSON files. Beginning ingestion...`);

  for (const file of files) {
    const filePath = path.join(roadmapsDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      const roadmap = RoadmapSchema.parse(data);

      const { error } = await supabase
        .from('roadmaps')
        .upsert({
          title: roadmap.title,
          slug: roadmap.slug,
          description: roadmap.description,
          type: roadmap.type,
          difficulty_level: roadmap.difficulty_level,
          duration_days: roadmap.duration_days,
          cover_image: roadmap.cover_image,
          is_premium: roadmap.is_premium ?? false,
          is_published: roadmap.is_published ?? true,
          meta: roadmap.meta ?? null
        }, { onConflict: 'slug' });

      if (error) {
        console.error(`[ERROR] File ${file}: Failed to upsert roadmap - ${error.message}`);
        errorCount++;
        continue;
      }

      console.log(`Roadmap ${roadmap.title} — ✓ seeded`);
      seededCount++;
    } catch (err: any) {
      console.error(`[ERROR] File ${file}: ${err.message || 'Unknown error during ingestion'}`);
      errorCount++;
    }
  }

  console.log(`\nDONE: ${seededCount} roadmaps seeded, ${errorCount} errors`);
}

runSeeder();
