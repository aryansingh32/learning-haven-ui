import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables. Try .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: fs.existsSync(envLocalPath) ? envLocalPath : envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: missing Supabase URL or Key in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define Zod schema
const ChapterSchema = z.object({
    roadmap_slug: z.string(),
    chapter_number: z.number(),
    title: z.string(),
    topic_tag: z.string(),
    difficulty: z.string(),
    est_minutes: z.number(),
    story_hook: z.string(),
    whatsapp_msg: z.string(),
    video: z.object({
        youtube_id: z.string(),
        channel: z.string().optional(),
        title: z.string(),
        duration_min: z.number().optional(),
        timestamps: z.array(z.object({
            label: z.string(),
            seconds: z.number()
        })).optional()
    }).optional(),
    article: z.object({
        url: z.string(),
        source: z.string(),
        title: z.string()
    }).optional(),
    problems: z.array(z.object({
        name: z.string(),
        platform: z.string(),
        difficulty: z.string(),
        url: z.string(),
        number: z.number().optional()
    })).optional(),
    quiz: z.array(z.object({
        q: z.string(),
        options: z.array(z.string()),
        answer: z.number(),
        explanation: z.string()
    })).optional(),
    tasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        difficulty: z.string()
    })).optional()
});

async function main() {
    const chaptersDir = path.resolve(process.cwd(), 'data/chapters');

    if (!fs.existsSync(chaptersDir)) {
        console.error(`Directory not found: ${chaptersDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.json'));

    let seeded = 0;
    let warnings = 0;
    let errors = 0;

    for (const file of files) {
        const filePath = path.join(chaptersDir, file);
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const rawJson = JSON.parse(fileContent);

            const parsed = ChapterSchema.safeParse(rawJson);
            if (!parsed.success) {
                console.error(`Error in file ${file}: Invalid schema`);
                console.error(JSON.stringify(parsed.error.format(), null, 2));
                errors++;
                continue;
            }

            const chapter = parsed.data;

            // a. Find roadmap by slug
            const { data: roadmapData, error: roadmapError } = await supabase
                .from('roadmaps')
                .select('*')
                .eq('slug', chapter.roadmap_slug)
                .single();

            if (roadmapError || !roadmapData) {
                console.warn(`Warning in ${file}: Roadmap not found: ${chapter.roadmap_slug}`);
                warnings++;
                continue;
            }

            const roadmapId = roadmapData.id;

            // b. Upsert chapter
            const { data: chapterRes, error: chapterError } = await supabase
                .from('chapters')
                .upsert({
                    roadmap_id: roadmapId,
                    chapter_number: chapter.chapter_number,
                    title: chapter.title,
                    topic_tag: chapter.topic_tag,
                    difficulty: chapter.difficulty,
                    est_minutes: chapter.est_minutes,
                    story_hook: chapter.story_hook,
                    whatsapp_msg: chapter.whatsapp_msg,
                }, { onConflict: 'roadmap_id,chapter_number' })
                .select('id')
                .single();

            if (chapterError) {
                console.error(`Error upserting chapter for ${file}:`, chapterError.message);
                errors++;
                continue;
            }

            // c. Upsert chapter_content
            const contentPayload = {
                chapter_id: chapterRes.id,
                video: chapter.video || null,
                article: chapter.article || null,
                problems: chapter.problems || null,
                quiz: chapter.quiz || null,
                tasks: chapter.tasks || null
            };

            const { error: contentError } = await supabase
                .from('chapter_content')
                .upsert(contentPayload, { onConflict: 'chapter_id' });

            if (contentError) {
                console.error(`Error upserting chapter content for ${file}:`, contentError.message);
                errors++;
                continue;
            }

            console.log(`Chapter ${chapter.chapter_number}: ${chapter.title} — ✓ seeded`);
            seeded++;

        } catch (err: any) {
            console.error(`Error processing file ${file}:`, err.message);
            errors++;
        }
    }

    console.log(`\nFinal summary: ${seeded} chapters seeded, ${warnings} warnings, ${errors} errors`);
}

main().catch(err => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
