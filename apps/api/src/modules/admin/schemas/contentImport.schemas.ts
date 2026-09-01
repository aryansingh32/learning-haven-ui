/**
 * contentImport.schemas.ts
 *
 * Single source of truth for all content-import Zod schemas.
 * Used by:
 *  - contentImport.service.ts  (validate rows before staging)
 *  - apps/api/scripts/seed-chapters.ts  (validate JSON files before seeding)
 *
 * Chapters are now a TWO-FILE pipeline:
 *   1. chapters_meta  – one row per chapter (8 metadata fields)
 *   2. chapter_steps  – one row per step (step_type + step_content_json blob)
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Chapter Meta Row Schema
// Matches public.chapters columns only (no chapter_content).
// "roadmap_slug" is resolved to a courses.slug lookup at validation time.
// ─────────────────────────────────────────────────────────────
export const chapterMetaRowSchema = z.object({
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
});

export type ChapterMetaRow = z.infer<typeof chapterMetaRowSchema>;

// ─────────────────────────────────────────────────────────────
// Step Content Discriminated Unions
// One branch per StepType — fields taken directly from what
// LearnChapterPage.tsx reads for that type (renderStepContent switch).
// ─────────────────────────────────────────────────────────────

const storyHookContentSchema = z.object({
    step_type: z.literal('story_hook'),
    // c.story  (LearnChapterPage.tsx line 298)
    story: z.string().optional(),
});

const videoTimelineEventSchema = z.object({
    start_sec:     z.number(),
    end_sec:       z.number().optional(),
    type:          z.enum(['flashcard', 'note', 'quiz', 'doc', 'message']),
    title:         z.string().optional(),
    body:          z.string(),
    front:         z.string().optional(),
    options:       z.array(z.string()).optional(),
    correct_index: z.number().optional(),
});

const videoContentSchema = z.object({
    step_type: z.literal('video'),
    // c.youtube_url / c.youtube_id  (lines 305-306)
    youtube_url:  z.string().optional(),
    youtube_id:   z.string().optional(),
    // c.title, c.channel, c.duration_min, c.focus_note  (lines 306-309)
    title:        z.string().optional(),
    channel:      z.string().optional(),
    duration_min: z.union([z.number(), z.string().transform(Number)]).pipe(z.number()).optional(),
    focus_note:   z.string().optional(),
    // c.timeline — timestamp-synced flashcards/notes/quizzes below the player
    timeline:     z.array(videoTimelineEventSchema).optional(),
});

const docContentSchema = z.object({
    step_type: z.literal('doc'),
    // c.doc_md  (line 316)
    doc_md: z.string().optional(),
});

const visualizerFrameSchema = z.object({
    array:     z.array(z.union([z.number(), z.string()])).optional(),
    highlight: z.array(z.number()).optional(),
    swapped:   z.array(z.number()).optional(),
    pointer_labels: z.record(z.string(), z.number()).optional(),
    caption:   z.string(),
});

const visualizerContentSchema = z.object({
    step_type: z.literal('visualizer'),
    // c.visualizer.url / .task / .notes  (legacy external-link mode, lines 320-323)
    // c.visualizer.frames  (interactive step-by-step mode, admin-authored)
    visualizer: z.object({
        url:   z.string().optional(),
        task:  z.string().optional(),
        notes: z.string().optional(),
        title: z.string().optional(),
        frames: z.array(visualizerFrameSchema).min(1).optional(),
    }).optional(),
});

const practiceProblemSchema = z.object({
    id:              z.string(),
    prompt:          z.string(),
    input_type:      z.enum(['text', 'code', 'mcq']).optional(),
    buggy_code:      z.string().optional(),
    expected_fix:    z.string().optional(),
    expected_output: z.string().optional(),
    url:             z.string().optional(),
});

const practiceContentSchema = z.object({
    step_type: z.literal('practice'),
    // c.practice_problems  (line 329)
    practice_problems: z.array(practiceProblemSchema).optional(),
});

const quizQuestionSchema = z.object({
    // LearnChapterPage.tsx line 347-350:
    //   q.question, q.options, q.correctAnswer (TEXT — not index!), q.explanation
    question:      z.string(),
    options:       z.array(z.string()),
    correctAnswer: z.string(),   // the answer TEXT; page does options.indexOf(correctAnswer)
    explanation:   z.string().optional(),
});

const quizContentSchema = z.object({
    step_type: z.literal('quiz'),
    // c.quiz_questions  (line 346)
    quiz_questions: z.array(quizQuestionSchema).optional(),
    pass_rule:      z.string().optional(),
});

const taskContentSchema = z.object({
    step_type: z.literal('task'),
    // c.task_prompt  (line 365)
    task_prompt: z.string().optional(),
});

const microRevisionContentSchema = z.object({
    step_type: z.literal('micro_revision'),
    // c.connection_map, c.recall_questions, c.identity_affirmation, c.streak_reminder
    // (LearnChapterPage.tsx lines 375-378)
    connection_map:       z.string().optional(),
    recall_questions:     z.array(z.string()).optional(),
    identity_affirmation: z.string().optional(),
    streak_reminder:      z.string().optional(),
});

const completeContentSchema = z.object({
    step_type: z.literal('complete'),
    // c.completion_celebration.message  (line 401)
    completion_celebration: z.object({
        message:           z.string().optional(),
        linkedin_card_text: z.string().optional(),
    }).optional(),
});

/**
 * Discriminated union on step_type — covers all 9 real StepType values.
 * This is what step_content_json must deserialise to.
 */
export const stepContentUnion = z.discriminatedUnion('step_type', [
    storyHookContentSchema,
    videoContentSchema,
    docContentSchema,
    visualizerContentSchema,
    practiceContentSchema,
    quizContentSchema,
    taskContentSchema,
    microRevisionContentSchema,
    completeContentSchema,
]);

export type StepContentUnion = z.infer<typeof stepContentUnion>;

// ─────────────────────────────────────────────────────────────
// Chapter Step Row Schema
// One row per step.  step_content_json is a JSON *string* in the CSV;
// validateRows parses it then runs it through stepContentUnion.
// ─────────────────────────────────────────────────────────────
export const stepRowSchema = z.object({
    roadmap_slug:   z.string().min(1, 'roadmap_slug is required'),
    chapter_number: z.union([z.number(), z.string().transform((v) => parseInt(v, 10))]).pipe(
        z.number().int().positive()
    ),
    step_number:    z.union([z.number(), z.string().transform((v) => parseInt(v, 10))]).pipe(
        z.number().int().positive()
    ),
    step_type: z.enum([
        'story_hook',
        'video',
        'doc',
        'visualizer',
        'practice',
        'quiz',
        'task',
        'micro_revision',
        'complete',
    ]),
    step_title:        z.string().min(1, 'step_title is required'),
    // Stored as a JSON string in the CSV; parsed + validated by validateRows
    step_content_json: z.string().min(1, 'step_content_json is required'),
});

export type StepRow = z.infer<typeof stepRowSchema>;

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
// 'chapters' is split into 'chapters_meta' + 'chapter_steps'
// ─────────────────────────────────────────────────────────────
export const CONTENT_TYPE_SCHEMAS = {
    chapters_meta:  chapterMetaRowSchema,
    chapter_steps:  stepRowSchema,
    problems:       problemRowSchema,
    build_stages:   buildStageRowSchema,
} as const;

export type ContentType = keyof typeof CONTENT_TYPE_SCHEMAS;

// ─────────────────────────────────────────────────────────────
// Template example rows — one filled example per content type.
// generateTemplate() uses these so the template can never drift
// from the actual Zod schema field names.
// ─────────────────────────────────────────────────────────────
export const TEMPLATE_EXAMPLES: Record<ContentType, Record<string, string>> = {
    chapters_meta: {
        roadmap_slug:   'dsa-masterclass',
        chapter_number: '1',
        title:          'Arrays & Hashing',
        topic_tag:      'Arrays',
        difficulty:     'BEGINNER',
        est_minutes:    '45',
        story_hook:     'In this chapter you will master array manipulation.',
        whatsapp_msg:   'Chapter 1 is now live!',
    },
    chapter_steps: {
        roadmap_slug:      'dsa-masterclass',
        chapter_number:    '1',
        step_number:       '1',
        step_type:         'story_hook',
        step_title:        'Why Arrays Matter',
        step_content_json: JSON.stringify({ step_type: 'story_hook', story: 'Arrays are the backbone of every algorithm you will ever write.' }),
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
