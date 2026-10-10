/**
 * Course export (slice W2-L1): the two CSV files must be readable by the
 * existing staged import (parseCsv + validateRows) and give back the same
 * chapters and steps. Also checks the admin learning-settings form.
 */
jest.mock('../config/database', () => ({ pool: { query: jest.fn() }, supabase: {}, supabaseAdmin: {} }));

import { parseCsv } from '../modules/core/utils/csv.util';
import { ContentImportService } from '../modules/admin/services/contentImport.service';
import {
    buildChaptersMetaCsv, buildChapterStepsCsv, csvCell, parseLearningSettings, type ExportChapter, type ExportStep,
} from '../modules/admin/services/courseLearningAdmin.service';

const SLUG = 'dsa-basics';
const chapters: ExportChapter[] = [
    { chapter_number: 2, title: 'Stacks, queues & "deques"', topic_tag: 'stacks', difficulty: 'INTERMEDIATE', est_minutes: 45,
      story_hook: 'Plates pile up,\nthe last one goes first.', whatsapp_msg: null },
    { chapter_number: 1, title: 'Arrays', topic_tag: null, difficulty: 'BEGINNER', est_minutes: 30, story_hook: null, whatsapp_msg: 'Day 1!' },
];
const steps: ExportStep[] = [
    { chapter_number: 1, step_number: 2, type: 'doc', title: 'Read, then try',
      content: { doc_md: '# Arrays\n\nAn array holds items, side by side, "in order".\n\n```js\nconst a = [1, 2];\n```' } },
    { chapter_number: 1, step_number: 1, type: 'video', title: 'Watch',
      content: { youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration_min: 12, timeline: [{ start_sec: 30, type: 'note', body: 'Index from 0' }] } },
    { chapter_number: 2, step_number: 1, type: 'quiz', title: 'Check yourself',
      content: { quiz_questions: [{ question: 'Which is LIFO?', options: ['Queue', 'Stack'], correctAnswer: 'Stack', explanation: 'Last in, first out.' }] } },
];

beforeEach(() => {
    jest.spyOn(ContentImportService as unknown as { _loadCourseSlugs: () => Promise<Map<string, string>> }, '_loadCourseSlugs')
        .mockResolvedValue(new Map([[SLUG, 'course-1']]));
});

describe('course export → import round trip', () => {
    it('chapters_meta: every row validates and comes back the same', async () => {
        const csv = buildChaptersMetaCsv(SLUG, chapters);
        const validated = await ContentImportService.validateRows(parseCsv(csv), 'chapters_meta');
        expect(validated.map((v) => v.errors)).toEqual([[], []]);
        expect(validated.map((v) => v.status)).toEqual(['valid', 'valid']);
        const back = validated.map((v) => v.row);
        expect(back[0]).toMatchObject({ roadmap_slug: SLUG, chapter_number: 1, title: 'Arrays', difficulty: 'BEGINNER', est_minutes: 30, whatsapp_msg: 'Day 1!' });
        expect(back[1]).toMatchObject({
            chapter_number: 2, title: 'Stacks, queues & "deques"', topic_tag: 'stacks', difficulty: 'INTERMEDIATE', est_minutes: 45,
            // The import reads one line per row, so line breaks in a chapter's hook become spaces.
            story_hook: 'Plates pile up, the last one goes first.',
        });
    });

    it('chapter_steps: every row validates and the step content is identical', async () => {
        const csv = buildChapterStepsCsv(SLUG, steps);
        const validated = await ContentImportService.validateRows(parseCsv(csv), 'chapter_steps');
        expect(validated.every((v) => v.status === 'valid')).toBe(true);
        const back = validated.map((v) => ({
            chapter_number: v.row.chapter_number, step_number: v.row.step_number, type: v.row.step_type, title: v.row.step_title,
            content: JSON.parse(v.row.step_content_json),
        }));
        const sorted = [...steps].sort((a, b) => a.chapter_number - b.chapter_number || a.step_number - b.step_number);
        expect(back).toEqual(sorted);
    });

    it('fills table defaults so chapters with empty fields still import', async () => {
        const csv = buildChaptersMetaCsv(SLUG, [{ chapter_number: 3, title: 'Heaps', topic_tag: null, difficulty: null, est_minutes: null, story_hook: null, whatsapp_msg: null }]);
        const [v] = await ContentImportService.validateRows(parseCsv(csv), 'chapters_meta');
        expect(v.status).toBe('valid');
        expect(v.row).toMatchObject({ difficulty: 'BEGINNER', est_minutes: 60 });
    });

    it('quotes cells the CSV parser would split', () => {
        expect(csvCell('a,b')).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell(null)).toBe('');
        expect(csvCell('one\ntwo')).toBe('one two');
    });
});

describe('learning settings form', () => {
    const self = '0c000000-0000-4000-8000-000000000001';
    const other = '0c000000-0000-4000-8000-000000000002';
    it('accepts a drip interval and prerequisites (deduplicated)', () => {
        expect(parseLearningSettings({ drip_interval_days: '7', prerequisite_ids: [other, other] }, self))
            .toEqual({ drip_interval_days: 7, prerequisite_ids: [other] });
        expect(parseLearningSettings({ drip_interval_days: '', prerequisite_ids: [] }, self)).toEqual({ drip_interval_days: null, prerequisite_ids: [] });
    });
    it('refuses out-of-range intervals, self-prerequisites and junk ids', () => {
        expect(typeof parseLearningSettings({ drip_interval_days: 0 }, self)).toBe('string');
        expect(typeof parseLearningSettings({ drip_interval_days: 1.5 }, self)).toBe('string');
        expect(typeof parseLearningSettings({ drip_interval_days: 366 }, self)).toBe('string');
        expect(typeof parseLearningSettings({ prerequisite_ids: [self] }, self)).toBe('string');
        expect(typeof parseLearningSettings({ prerequisite_ids: ['x'] }, self)).toBe('string');
    });
});
