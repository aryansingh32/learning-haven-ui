/**
 * contentImport.service.ts
 *
 * Staged import pipeline for chapters_meta, chapter_steps, problems, and build_stages.
 *
 * Flow:
 *   parseSource → validateRows → stageBatch → (admin reviews) → publishBatch
 *
 * CONSTRAINT: No writes to live content tables (chapters/problems/build_stages)
 * happen anywhere except inside publishBatch, which wraps everything in a
 * pg transaction.
 */
import { supabaseAdmin, pool } from '../../../config/database';
import { GoogleSheetsService } from '../../core/services/googleSheets.service';
import { parseCsv } from '../../core/utils/csv.util';
import { CategoriesService } from '../../learning/services/categories.service';
import { AdminChaptersService } from './admin-chapters.service';
import {
    CONTENT_TYPE_SCHEMAS,
    TEMPLATE_EXAMPLES,
    stepContentUnion,
    type ContentType,
    type ChapterMetaRow,
    type StepRow,
    type ProblemRow,
    type BuildStageRow,
    type TestseriesQuestionRow,
} from '../schemas/contentImport.schemas';
import logger from '../../../config/logger';

// ─── Types ────────────────────────────────────────────────────

export interface ValidatedRow {
    row: Record<string, any>;
    status: 'valid' | 'error' | 'warning';
    errors: string[];
}

export interface StagedBatch {
    batch_id: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    warning_rows: number;
    rows: Array<ValidatedRow & { id: string; row_number: number }>;
}

// ─── Service ──────────────────────────────────────────────────

export class ContentImportService {
    // ══════════════════════════════════════════════════════════
    // 1. parseSource
    //    Returns raw row objects from a file buffer or sheet URL.
    //    Does NOT write anything to the DB.
    // ══════════════════════════════════════════════════════════
    static async parseSource(
        input: { file?: Buffer; sheetUrl?: string },
        _contentType: ContentType
    ): Promise<Record<string, any>[]> {
        if (input.sheetUrl) {
            return GoogleSheetsService.fetchCsvData(input.sheetUrl);
        }
        if (input.file) {
            const text = input.file.toString('utf8');
            return parseCsv(text);
        }
        throw new Error('Either file or sheetUrl must be provided');
    }

    // ══════════════════════════════════════════════════════════
    // 2. validateRows
    //    Runs each row through the matching Zod schema, then
    //    applies business-rule checks beyond Zod.
    //    Returns status + errors per row — no DB writes.
    // ══════════════════════════════════════════════════════════
    static async validateRows(
        rows: Record<string, any>[],
        contentType: ContentType
    ): Promise<ValidatedRow[]> {
        const schema = CONTENT_TYPE_SCHEMAS[contentType];
        const results: ValidatedRow[] = [];

        // Pre-load lookup data for business rule checks
        let courseSlugToId: Map<string, string> | null = null;
        let programSlugToId: Map<string, string> | null = null;
        let testSlugToId: Map<string, string> | null = null;

        if (contentType === 'chapters_meta' || contentType === 'chapter_steps') {
            courseSlugToId = await this._loadCourseSlugs();
        }
        if (contentType === 'build_stages') {
            programSlugToId = await this._loadProgramSlugs();
        }
        if (contentType === 'testseries_questions') {
            testSlugToId = await this._loadTestSlugs();
        }

        // Track within-batch uniqueness
        const seenChapterKeys = new Set<string>();   // `${course_id}:${chapter_number}`
        const seenSlugs = new Set<string>();          // derived problem slugs
        const seenStageKeys = new Set<string>();      // `${program_id}:${stage_number}`
        const seenStepKeys = new Set<string>();       // `${roadmap_slug}:${chapter_number}:${step_number}`

        for (const row of rows) {
            const errors: string[] = [];
            let status: 'valid' | 'error' | 'warning' = 'valid';

            // — Zod validation —
            const parsed = schema.safeParse(row);
            if (!parsed.success) {
                parsed.error.issues.forEach((issue) => {
                    errors.push(`[${issue.path.join('.') || 'row'}] ${issue.message}`);
                });
                status = 'error';
            }

            const data = parsed.success ? parsed.data : row;

            // — Business rule checks —

            if (contentType === 'chapters_meta' && courseSlugToId) {
                const courseId = courseSlugToId.get((data as ChapterMetaRow).roadmap_slug);
                if (!courseId) {
                    errors.push(
                        `roadmap_slug "${(data as ChapterMetaRow).roadmap_slug}" does not match any course slug`
                    );
                    status = 'error';
                } else {
                    const key = `${courseId}:${(data as ChapterMetaRow).chapter_number}`;
                    if (seenChapterKeys.has(key)) {
                        errors.push(
                            `Duplicate chapter_number ${(data as ChapterMetaRow).chapter_number} for course "${(data as ChapterMetaRow).roadmap_slug}" within this batch`
                        );
                        status = 'error';
                    } else {
                        seenChapterKeys.add(key);
                    }
                }
            }

            if (contentType === 'chapter_steps' && courseSlugToId) {
                const rowData = data as StepRow;

                // Within-batch step_number uniqueness per (roadmap_slug, chapter_number)
                const stepKey = `${rowData.roadmap_slug}:${rowData.chapter_number}:${rowData.step_number}`;
                if (seenStepKeys.has(stepKey)) {
                    errors.push(
                        `Duplicate step_number ${rowData.step_number} for chapter ${rowData.chapter_number} of "${rowData.roadmap_slug}" within this batch`
                    );
                    status = 'error';
                } else {
                    seenStepKeys.add(stepKey);
                }

                // step_content_json must be valid JSON and match its step_type branch
                if (rowData.step_content_json) {
                    let parsed_content: unknown;
                    try {
                        parsed_content = JSON.parse(rowData.step_content_json);
                    } catch {
                        errors.push('step_content_json is not valid JSON');
                        status = 'error';
                        parsed_content = null;
                    }

                    if (parsed_content !== null) {
                        // Inject step_type into the content object so the discriminated union works
                        const contentObj =
                            typeof parsed_content === 'object' && parsed_content !== null
                                ? { ...parsed_content as Record<string, unknown>, step_type: rowData.step_type }
                                : parsed_content;

                        const contentResult = stepContentUnion.safeParse(contentObj);
                        if (!contentResult.success) {
                            contentResult.error.issues.forEach((issue) => {
                                errors.push(`[step_content_json.${issue.path.join('.') || 'root'}] ${issue.message}`);
                            });
                            status = 'error';
                        }
                    }
                }
            }

            if (contentType === 'problems') {
                const slug = ((data as ProblemRow).title || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                if (seenSlugs.has(slug)) {
                    errors.push(
                        `Duplicate derived slug "${slug}" (from title "${(data as ProblemRow).title}") within this batch`
                    );
                    status = status === 'error' ? 'error' : 'warning';
                } else {
                    seenSlugs.add(slug);
                }
            }

            if (contentType === 'build_stages' && programSlugToId) {
                const programId = programSlugToId.get((data as BuildStageRow).program_slug);
                if (!programId) {
                    errors.push(
                        `program_slug "${(data as BuildStageRow).program_slug}" does not match any apprenticeship program`
                    );
                    status = 'error';
                } else {
                    const key = `${programId}:${(data as BuildStageRow).stage_number}`;
                    if (seenStageKeys.has(key)) {
                        errors.push(
                            `Duplicate stage_number ${(data as BuildStageRow).stage_number} for program "${(data as BuildStageRow).program_slug}" within this batch`
                        );
                        status = 'error';
                    } else {
                        seenStageKeys.add(key);
                    }
                }
            }

            if (contentType === 'testseries_questions') {
                const rowData = data as TestseriesQuestionRow;
                const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

                if (rowData.test_slug && !testSlugToId!.has(rowData.test_slug)) {
                    errors.push(`test_slug "${rowData.test_slug}" does not match any existing test`);
                    status = 'error';
                }

                if (rowData.question_type === 'nat') {
                    if (rowData.nat_answer === undefined || rowData.nat_answer === null || Number.isNaN(rowData.nat_answer)) {
                        errors.push('nat_answer is required (and must be numeric) for nat questions');
                        status = 'error';
                    }
                } else {
                    const filledLetters = OPTION_LETTERS.filter((l) => {
                        const v = (rowData as any)[`option_${l}`];
                        return typeof v === 'string' && v.trim().length > 0;
                    });
                    if (filledLetters.length < 2) {
                        errors.push('mcq/msq questions need at least 2 non-empty options (option_a, option_b, ...)');
                        status = 'error';
                    }
                    const correctLetters = (rowData.correct_options || '')
                        .split(',')
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean);
                    if (correctLetters.length === 0) {
                        errors.push('correct_options is required for mcq/msq (comma-separated option letters, e.g. "b" or "a,c")');
                        status = 'error';
                    } else if (rowData.question_type === 'mcq' && correctLetters.length !== 1) {
                        errors.push('mcq questions must have exactly one correct option in correct_options');
                        status = 'error';
                    } else {
                        const invalidLetters = correctLetters.filter((l) => !filledLetters.includes(l as any));
                        if (invalidLetters.length > 0) {
                            errors.push(`correct_options references option letter(s) with no text: ${invalidLetters.join(', ')}`);
                            status = 'error';
                        }
                    }
                }
            }

            results.push({ row: data, status, errors });
        }

        return results;
    }

    // ══════════════════════════════════════════════════════════
    // 3. stageBatch
    //    Writes one content_import_batches row +
    //    one content_import_rows row per item.
    //    Returns the batch_id and row-level details.
    // ══════════════════════════════════════════════════════════
    static async stageBatch(
        contentType: ContentType,
        source: 'upload' | 'sheet_url' | 'json',
        sourceRef: string,
        uploadedBy: string,
        validatedRows: ValidatedRow[]
    ): Promise<StagedBatch> {
        const totalRows = validatedRows.length;
        const validRows = validatedRows.filter((r) => r.status === 'valid').length;
        const warningRows = validatedRows.filter((r) => r.status === 'warning').length;
        const errorRows = validatedRows.filter((r) => r.status === 'error').length;

        // Insert the batch header
        const { data: batch, error: batchErr } = await supabaseAdmin
            .from('content_import_batches')
            .insert({
                content_type: contentType,
                source,
                source_ref: sourceRef,
                uploaded_by: uploadedBy,
                status: 'pending',
                total_rows: totalRows,
                valid_rows: validRows,
                error_rows: errorRows,
            })
            .select('id')
            .single();

        if (batchErr || !batch) {
            throw new Error(`Failed to create import batch: ${batchErr?.message}`);
        }

        // Insert one row per validated item
        const rowInserts = validatedRows.map((vr, idx) => ({
            batch_id: batch.id,
            row_number: idx + 1,
            raw_data: vr.row,
            status: vr.status,
            errors: vr.errors,
        }));

        const { data: insertedRows, error: rowsErr } = await supabaseAdmin
            .from('content_import_rows')
            .insert(rowInserts)
            .select('id, row_number, raw_data, status, errors');

        if (rowsErr) {
            // Rollback batch header if rows fail
            await supabaseAdmin.from('content_import_batches').delete().eq('id', batch.id);
            throw new Error(`Failed to stage import rows: ${rowsErr.message}`);
        }

        return {
            batch_id: batch.id,
            total_rows: totalRows,
            valid_rows: validRows,
            error_rows: errorRows,
            warning_rows: warningRows,
            rows: (insertedRows || []).map((r) => ({
                id: r.id,
                row_number: r.row_number,
                row: r.raw_data,
                status: r.status as 'valid' | 'error' | 'warning',
                errors: r.errors as string[],
            })),
        };
    }

    // ══════════════════════════════════════════════════════════
    // 4. publishBatch
    //    Runs inside a pg transaction.
    //    Upserts valid (and optionally warning) rows into live tables,
    //    sets resolved_entity_id on each row,
    //    marks batch as 'published',
    //    writes one admin_audit_logs entry.
    // ══════════════════════════════════════════════════════════
    static async publishBatch(batchId: string, force = false): Promise<{
        published: number;
        skipped: number;
        errors: string[];
    }> {
        // Load batch
        const { data: batch, error: batchErr } = await supabaseAdmin
            .from('content_import_batches')
            .select('*')
            .eq('id', batchId)
            .single();

        if (batchErr || !batch) throw new Error('Batch not found');
        if (batch.status === 'published') throw new Error('Batch already published');

        // Load rows
        const { data: rows, error: rowsErr } = await supabaseAdmin
            .from('content_import_rows')
            .select('*')
            .eq('batch_id', batchId)
            .order('row_number', { ascending: true });

        if (rowsErr) throw new Error(`Failed to load rows: ${rowsErr.message}`);

        const eligibleRows = (rows || []).filter(
            (r) => r.status === 'valid' || (force && r.status === 'warning')
        );

        const client = await pool.connect();
        const publishedIds: Record<string, string> = {}; // row.id → entity_id
        const publishErrors: string[] = [];
        let published = 0;
        let skipped = (rows || []).length - eligibleRows.length;

        try {
            await client.query('BEGIN');

            const contentType: ContentType = batch.content_type;

            // ── chapter_steps: group by (roadmap_slug, chapter_number) and call replaceSteps ──
            if (contentType === 'chapter_steps') {
                // Build groups
                const groups = new Map<string, Array<{ rowId: string; data: StepRow }>>();
                for (const row of eligibleRows) {
                    const d = row.raw_data as StepRow;
                    const key = `${d.roadmap_slug}:${d.chapter_number}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push({ rowId: row.id, data: d });
                }

                for (const [groupKey, groupRows] of groups) {
                    const [roadmapSlug, chapterNumberStr] = groupKey.split(':');
                    const chapterNumber = parseInt(chapterNumberStr, 10);

                    // Resolve chapter_id — chapter MUST already exist (publish chapters_meta first)
                    const chapterRes = await client.query(
                        `SELECT c.id FROM public.chapters c
                         JOIN public.courses co ON co.id = c.course_id
                         WHERE co.slug = $1 AND c.chapter_number = $2
                         LIMIT 1`,
                        [roadmapSlug, chapterNumber]
                    );

                    if (chapterRes.rows.length === 0) {
                        const errMsg = `Chapter not found for roadmap_slug "${roadmapSlug}", chapter_number ${chapterNumber}. Publish chapters_meta first.`;
                        publishErrors.push(`Group ${groupKey}: ${errMsg}`);
                        for (const { rowId } of groupRows) {
                            skipped++;
                        }
                        continue;
                    }

                    const chapterId: string = chapterRes.rows[0].id;

                    // Sort by step_number, build steps array for replaceSteps
                    const sortedRows = groupRows
                        .slice()
                        .sort((a, b) => a.data.step_number - b.data.step_number);

                    const steps = sortedRows.map(({ data }) => {
                        let content: Record<string, unknown> = {};
                        try {
                            const parsed = JSON.parse(data.step_content_json);
                            // Remove the step_type discriminator key from the stored content object
                            const { step_type: _discrim, ...rest } = parsed as Record<string, unknown>;
                            content = rest;
                        } catch {
                            // Already validated; should not reach here for valid rows
                        }
                        return {
                            step_number: data.step_number,
                            type: data.step_type,
                            title: data.step_title,
                            content,
                        };
                    });

                    try {
                        // replaceSteps deletes existing steps and inserts fresh ones
                        await AdminChaptersService.replaceSteps(chapterId, steps);
                        // Mark all rows in this group as published
                        for (const { rowId } of sortedRows) {
                            publishedIds[rowId] = chapterId;
                            published++;
                        }
                    } catch (err: any) {
                        const errMsg = `replaceSteps failed for chapter ${chapterId}: ${err.message}`;
                        publishErrors.push(`Group ${groupKey}: ${errMsg}`);
                        for (const { rowId: _rid } of sortedRows) {
                            skipped++;
                        }
                    }
                }
            } else {
                // ── All other content types: row-by-row upsert ──
                for (const row of eligibleRows) {
                    try {
                        const entityId = await this._upsertRow(
                            contentType,
                            row.raw_data,
                            client
                        );
                        publishedIds[row.id] = entityId;
                        published++;
                    } catch (err: any) {
                        publishErrors.push(`Row ${row.row_number}: ${err.message}`);
                        skipped++;
                    }
                }
            }

            // Update resolved_entity_id on each successfully published row
            for (const [rowId, entityId] of Object.entries(publishedIds)) {
                await client.query(
                    `UPDATE public.content_import_rows
                     SET resolved_entity_id = $1
                     WHERE id = $2`,
                    [entityId, rowId]
                );
            }

            // Mark batch as published
            await client.query(
                `UPDATE public.content_import_batches
                 SET status = 'published', published_at = now()
                 WHERE id = $1`,
                [batchId]
            );

            // Write audit log
            await client.query(
                `INSERT INTO public.admin_audit_logs
                   (admin_id, action, entity_type, entity_id, new_value)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    batch.uploaded_by,
                    'content_import_publish',
                    contentType,
                    batchId,
                    JSON.stringify({ published, skipped, errors: publishErrors }),
                ]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        return { published, skipped, errors: publishErrors };
    }

    // ══════════════════════════════════════════════════════════
    // 5. generateTemplate
    //    Returns a CSV string with header row + one example row.
    //    Headers are derived directly from TEMPLATE_EXAMPLES to
    //    guarantee they always match the Zod schema field names.
    // ══════════════════════════════════════════════════════════
    static generateTemplate(contentType: ContentType): string {
        const example = TEMPLATE_EXAMPLES[contentType];
        const headers = Object.keys(example);
        const values = headers.map((h) => {
            const v = example[h];
            // Quote values that contain commas or double-quotes
            if (v.includes(',') || v.includes('"')) {
                return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
        });
        return [headers.join(','), values.join(',')].join('\n');
    }

    // ══════════════════════════════════════════════════════════
    // Private helpers
    // ══════════════════════════════════════════════════════════

    /** Upserts one row into the appropriate live table. Returns the entity UUID. */
    private static async _upsertRow(
        contentType: ContentType,
        rawData: Record<string, any>,
        client: any
    ): Promise<string> {
        if (contentType === 'chapters_meta') {
            return this._upsertChapterMeta(rawData as ChapterMetaRow, client);
        }
        if (contentType === 'problems') {
            return this._upsertProblem(rawData as ProblemRow);
        }
        if (contentType === 'build_stages') {
            return this._upsertBuildStage(rawData as BuildStageRow, client);
        }
        if (contentType === 'testseries_questions') {
            return this._upsertTestseriesQuestion(rawData as TestseriesQuestionRow, client);
        }
        // chapter_steps is handled separately in publishBatch (grouped replaceSteps)
        throw new Error(`Unknown content type: ${contentType}`);
    }

    /** Upsert chapter metadata only (no chapter_content, no steps). */
    private static async _upsertChapterMeta(data: ChapterMetaRow, client: any): Promise<string> {
        // Resolve course slug → course_id
        const courseRes = await client.query(
            `SELECT id FROM public.courses WHERE slug = $1 LIMIT 1`,
            [data.roadmap_slug]
        );
        if (courseRes.rows.length === 0) {
            throw new Error(`Course slug "${data.roadmap_slug}" not found`);
        }
        const courseId: string = courseRes.rows[0].id;

        // Upsert chapter (metadata fields only — no writes to chapter_content)
        const chapterRes = await client.query(
            `INSERT INTO public.chapters
               (course_id, chapter_number, title, topic_tag, difficulty,
                story_hook, whatsapp_msg, est_minutes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (course_id, chapter_number)
             DO UPDATE SET
               title        = EXCLUDED.title,
               topic_tag    = EXCLUDED.topic_tag,
               difficulty   = EXCLUDED.difficulty,
               story_hook   = EXCLUDED.story_hook,
               whatsapp_msg = EXCLUDED.whatsapp_msg,
               est_minutes  = EXCLUDED.est_minutes
             RETURNING id`,
            [
                courseId,
                data.chapter_number,
                data.title,
                data.topic_tag ?? null,
                data.difficulty ?? null,
                data.story_hook ?? null,
                data.whatsapp_msg ?? null,
                data.est_minutes ?? null,
            ]
        );
        return chapterRes.rows[0].id;
    }

    /**
     * Upsert problem — reuses the exact logic from CategoriesService.importProblems
     * to avoid two divergent code paths for the same table.
     */
    private static async _upsertProblem(data: ProblemRow): Promise<string> {
        // Delegate entirely to the canonical importProblems logic
        const result = await CategoriesService.importProblems('system', [
            {
                title: data.title,
                description: data.description,
                difficulty: data.difficulty,
                category: data.topic,   // CategoriesService maps `category` → `topic` column
                companies: data.companies as string[],
                hints: data.hints as string[],
                is_premium: data.is_premium as boolean,
                time_complexity: data.time_complexity,
                space_complexity: data.space_complexity,
            },
        ]);

        if (result.skipped > 0 && result.errors.length > 0) {
            throw new Error(result.errors[0]);
        }

        // Fetch the UUID of the upserted problem by derived slug
        const slug = data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const { data: problem, error } = await supabaseAdmin
            .from('problems')
            .select('id')
            .eq('slug', slug)
            .single();

        if (error || !problem) throw new Error(`Could not resolve problem UUID for slug "${slug}"`);
        return problem.id;
    }

    /** Upsert build_stage. Resolves program_slug → program_id first. */
    private static async _upsertBuildStage(data: BuildStageRow, client: any): Promise<string> {
        const programRes = await client.query(
            `SELECT id FROM public.apprenticeship_programs WHERE slug = $1 LIMIT 1`,
            [data.program_slug]
        );
        if (programRes.rows.length === 0) {
            throw new Error(`program_slug "${data.program_slug}" not found`);
        }
        const programId: string = programRes.rows[0].id;

        // Check if stage already exists (build_stages has no UNIQUE constraint, only an index)
        const existingRes = await client.query(
            `SELECT id FROM public.build_stages
             WHERE program_id = $1 AND stage_number = $2 LIMIT 1`,
            [programId, data.stage_number]
        );

        if (existingRes.rows.length > 0) {
            // UPDATE existing
            const stageId: string = existingRes.rows[0].id;
            await client.query(
                `UPDATE public.build_stages SET
                   title              = $1,
                   difficulty         = $2,
                   instructions       = $3,
                   code_example       = $4,
                   hints              = $5,
                   test_command       = $6,
                   docker_test_image  = $7,
                   timeout_seconds    = $8,
                   expected_exit_code = $9,
                   updated_at         = now()
                 WHERE id = $10`,
                [
                    data.title,
                    data.difficulty,
                    data.instructions || '',
                    data.code_example || '',
                    data.hints as string[],
                    data.test_command || '',
                    data.docker_test_image || '',
                    data.timeout_seconds ?? 120,
                    data.expected_exit_code ?? 0,
                    stageId,
                ]
            );
            return stageId;
        } else {
            // INSERT new
            const stageRes = await client.query(
                `INSERT INTO public.build_stages
                   (program_id, stage_number, title, difficulty, instructions,
                    code_example, hints, test_command, docker_test_image,
                    timeout_seconds, expected_exit_code)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id`,
                [
                    programId,
                    data.stage_number,
                    data.title,
                    data.difficulty,
                    data.instructions || '',
                    data.code_example || '',
                    data.hints as string[],
                    data.test_command || '',
                    data.docker_test_image || '',
                    data.timeout_seconds ?? 120,
                    data.expected_exit_code ?? 0,
                ]
            );
            return stageRes.rows[0].id;
        }
    }

    /**
     * Insert one question into the standalone CBT question bank
     * (public.testseries_questions), converting the flat option_a..option_f
     * CSV columns into the typed options/correct_options JSON columns.
     * Always inserts a new row -- there's no natural dedupe key for a
     * free-text question, so re-importing the same CSV creates duplicates
     * (use the Question Bank browser to remove any). If test_slug is
     * given, also attaches the question to that test's question list at
     * the next sort position.
     */
    private static async _upsertTestseriesQuestion(data: TestseriesQuestionRow, client: any): Promise<string> {
        const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
        let options: { id: string; text: string }[] | null = null;
        let correctOptions: string[] | null = null;

        if (data.question_type !== 'nat') {
            options = OPTION_LETTERS
                .map((letter) => ({ letter, text: (data as any)[`option_${letter}`] as string | undefined }))
                .filter((o) => o.text && o.text.trim().length > 0)
                .map((o) => ({ id: o.letter, text: o.text!.trim() }));
            correctOptions = (data.correct_options || '')
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
        }

        const questionRes = await client.query(
            `INSERT INTO public.testseries_questions
               (question_type, body, options, correct_options, nat_answer, nat_tolerance, marks, negative_marks, topic, difficulty, explanation)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
                data.question_type,
                data.body,
                options ? JSON.stringify(options) : null,
                correctOptions ? JSON.stringify(correctOptions) : null,
                data.question_type === 'nat' ? data.nat_answer : null,
                data.nat_tolerance ?? 0,
                data.marks ?? 1,
                data.negative_marks ?? 0,
                data.topic || null,
                data.difficulty || null,
                data.explanation || null,
            ]
        );
        const questionId: string = questionRes.rows[0].id;

        if (data.test_slug) {
            const testRes = await client.query(`SELECT id FROM public.tests WHERE slug = $1 LIMIT 1`, [data.test_slug]);
            if (testRes.rows.length > 0) {
                const testId: string = testRes.rows[0].id;
                const sortRes = await client.query(
                    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM public.test_questions WHERE test_id = $1`,
                    [testId]
                );
                await client.query(
                    `INSERT INTO public.test_questions (test_id, question_id, sort_order)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (test_id, question_id) DO NOTHING`,
                    [testId, questionId, sortRes.rows[0].next_order]
                );
            }
        }

        return questionId;
    }

    /** Loads all published+unpublished test slugs → IDs for testseries_questions validation. */
    private static async _loadTestSlugs(): Promise<Map<string, string>> {
        const { data, error } = await supabaseAdmin.from('tests').select('id, slug');
        if (error) throw new Error(`Failed to load tests: ${error.message}`);
        return new Map((data || []).map((t: any) => [t.slug, t.id]));
    }

    /** Loads all course slugs → IDs for chapter validation. */
    private static async _loadCourseSlugs(): Promise<Map<string, string>> {
        const { data, error } = await supabaseAdmin
            .from('courses')
            .select('id, slug');
        if (error) throw new Error(`Failed to load courses: ${error.message}`);
        return new Map((data || []).map((c: any) => [c.slug, c.id]));
    }

    /** Loads all apprenticeship_programs slugs → IDs for build_stage validation. */
    private static async _loadProgramSlugs(): Promise<Map<string, string>> {
        const { data, error } = await supabaseAdmin
            .from('apprenticeship_programs')
            .select('id, slug');
        if (error) throw new Error(`Failed to load programs: ${error.message}`);
        return new Map((data || []).map((p: any) => [p.slug, p.id]));
    }
}
