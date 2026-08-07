/**
 * contentImport.schemas.ts
 *
 * Single source of truth for all content-import Zod schemas.
 * Used by:
 *  - contentImport.service.ts  (validate rows before staging)
 *  - apps/api/scripts/seed-chapters.ts  (validate JSON files before seeding)
 *
 * Flat CSV columns are used for structured chapter data; nested objects
 * are reconstructed by the service from the flat fields.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Chapter Row Schema
// Matches public.chapters + public.chapter_content columns.
// "roadmap_slug" is resolved to a courses.slug lookup at validation time.
// ─────────────────────────────────────────────────────────────
export const chapterRowSchema = z.object({
    // Chapter fields
    roadmap_slug:   z.string().min(1, 'roadmap_slug is required'),
    chapter_number: z.union([z.number(), z.string().transform((v) => parseInt(v, 10))]).pipe(
        z.number().int().positive()
    ),
    title:          z.string().min(1, 'title is required'),
    topic_tag:      z.string().optional(),
    difficulty:     z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    est_minutes:    z.union([
        z.number().int().positive(),
        z.string().transform((v) => parseInt(v, 10)),
    ]).pipe(z.number().int().positive()).optional(),
    story_hook:     z.string().optional(),
    whatsapp_msg:   z.string().optional(),

    // Chapter content — flat CSV columns (video)
    video_youtube_id:    z.string().optional(),
    video_channel:       z.string().optional(),
    video_title:         z.string().optional(),
    video_duration_min:  z.union([
        z.number().int().nonnegative(),
        z.string().transform((v) => parseInt(v, 10)),
    ]).pipe(z.number().int().nonnegative()).optional(),
    video_timestamps_json: z.any().optional(), // array of {label, seconds}

    // Chapter content — flat CSV columns (article)
    article_url:    z.string().url().optional().or(z.literal('')),
    article_source: z.string().optional(),
    article_title:  z.string().optional(),

    // Chapter content — JSON blob columns (arrays)
    problems_json:  z.any().optional(), // array of problem refs
    quiz_json:      z.any().optional(), // array of quiz items
    tasks_json:     z.any().optional(), // array of tasks
});

export type ChapterRow = z.infer<typeof chapterRowSchema>;

// ─────────────────────────────────────────────────────────────
// Problem Row Schema
// Matches public.problems columns.
// companies and hints arrive as comma-separated strings from CSV
// (GoogleSheetsService.parseCsv / csv.util.parseCsv already splits them).
// ─────────────────────────────────────────────────────────────
export const problemRowSchema = z.object({
    title:           z.string().min(1, 'title is required'),
    description:     z.string().min(1, 'description is required'),
    difficulty:      z.enum(['easy', 'medium', 'hard'] as const),
    topic:           z.string().min(1, 'topic is required'),
    companies:       z.union([
        z.array(z.string()),
        z.string().transform((v) =>
            v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []
        ),
    ]).default([]),
    hints:           z.union([
        z.array(z.string()),
        z.string().transform((v) =>
            v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []
        ),
    ]).default([]),
    is_premium:      z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).default(false),
    time_complexity: z.string().optional().default(''),
    space_complexity: z.string().optional().default(''),
});

export type ProblemRow = z.infer<typeof problemRowSchema>;

// ─────────────────────────────────────────────────────────────
// Build Stage Row Schema
// Matches public.build_stages columns.
// "program_slug" is resolved to apprenticeship_programs.slug at validation time.
// ─────────────────────────────────────────────────────────────
export const buildStageRowSchema = z.object({
    program_slug:      z.string().min(1, 'program_slug is required'),
    stage_number:      z.union([
        z.number().int().positive(),
        z.string().transform((v) => parseInt(v, 10)),
    ]).pipe(z.number().int().positive()),
    title:             z.string().min(1, 'title is required'),
    difficulty:        z.enum(['easy', 'medium', 'hard'] as const),
    instructions:      z.string().optional().default(''),
    code_example:      z.string().optional().default(''),
    hints:             z.union([
        z.array(z.string()),
        z.string().transform((v) =>
            v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []
        ),
    ]).default([]),
    test_command:      z.string().optional().default(''),
    docker_test_image: z.string().optional().default(''),
    timeout_seconds:   z.union([
        z.number().int().positive(),
        z.string().transform((v) => parseInt(v, 10)),
    ]).pipe(z.number().int().positive()).default(120),
    expected_exit_code: z.union([
        z.number().int().nonnegative(),
        z.string().transform((v) => parseInt(v, 10)),
    ]).pipe(z.number().int().nonnegative()).default(0),
});

export type BuildStageRow = z.infer<typeof buildStageRowSchema>;

// ─────────────────────────────────────────────────────────────
// Content type → schema mapping (convenience)
// ─────────────────────────────────────────────────────────────
export const CONTENT_TYPE_SCHEMAS = {
    chapters:     chapterRowSchema,
    problems:     problemRowSchema,
    build_stages: buildStageRowSchema,
} as const;

export type ContentType = keyof typeof CONTENT_TYPE_SCHEMAS;

// ─────────────────────────────────────────────────────────────
// Template example rows — one filled example per content type.
// generateTemplate() uses these so the template can never drift
// from the actual Zod schema field names.
// ─────────────────────────────────────────────────────────────
export const TEMPLATE_EXAMPLES: Record<ContentType, Record<string, string>> = {
    chapters: {
        roadmap_slug:        'dsa-masterclass',
        chapter_number:      '1',
        title:               'Arrays & Hashing',
        topic_tag:           'Arrays',
        difficulty:          'BEGINNER',
        est_minutes:         '45',
        story_hook:          'In this chapter you will master array manipulation.',
        whatsapp_msg:        'Chapter 1 is now live!',
        video_youtube_id:    'dQw4w9WgXcQ',
        video_channel:       'NeetCode',
        video_title:         'Arrays Explained',
        video_duration_min:  '30',
        video_timestamps_json: '',
        article_url:         'https://example.com/arrays',
        article_source:      'GeeksForGeeks',
        article_title:       'Arrays in DSA',
        problems_json:       '',
        quiz_json:           '',
        tasks_json:          '',
    },
    problems: {
        title:           'Two Sum',
        description:     'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        difficulty:      'easy',
        topic:           'Arrays',
        companies:       'Google,Amazon,Meta',
        hints:           'Try using a hash map to store complements',
        is_premium:      'false',
        time_complexity: 'O(n)',
        space_complexity: 'O(n)',
    },
    build_stages: {
        program_slug:      'react-todo-app',
        stage_number:      '1',
        title:             'Project Setup',
        difficulty:        'easy',
        instructions:      'Initialize a new React project using Vite.',
        code_example:      'npm create vite@latest my-app -- --template react',
        hints:             'Use node 18+,Check the vite docs',
        test_command:      'npm test',
        docker_test_image: 'node:18-alpine',
        timeout_seconds:   '120',
        expected_exit_code: '0',
    },
};
