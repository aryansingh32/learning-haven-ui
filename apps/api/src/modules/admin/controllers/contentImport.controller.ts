/**
 * contentImport.controller.ts
 *
 * Handles all staged content-import routes.
 * All routes ride the router-level middleware:
 *   authenticateUser + requireAdmin + adminLogging
 * (applied in admin.ts — NOT repeated here)
 *
 * Multer (memory storage, 5 MB, .csv only) is wired only on the
 * POST /content/import route in admin.ts.
 */
import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ContentImportService } from '../services/contentImport.service';
import { type ContentType } from '../schemas/contentImport.schemas';
import logger from '../../../config/logger';
import { supabase } from '../../../config/database';

const VALID_CONTENT_TYPES: ContentType[] = ['chapters_meta', 'chapter_steps', 'problems', 'build_stages'];

function isValidContentType(v: unknown): v is ContentType {
    return VALID_CONTENT_TYPES.includes(v as ContentType);
}

export class ContentImportController {
    // ──────────────────────────────────────────────────────────
    // POST /api/admin/content/import
    // Accepts: multipart file (.csv) OR JSON { sheet_url, content_type }
    // Returns: { batch_id, total_rows, valid_rows, error_rows, rows }
    // Does NOT write to any live content table.
    // ──────────────────────────────────────────────────────────
    static async importContent(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;

            const contentType: string =
                (req.body.content_type as string) ||
                (req.query.content_type as string) || '';

            if (!isValidContentType(contentType)) {
                return res.status(400).json({
                    error: `content_type must be one of: ${VALID_CONTENT_TYPES.join(', ')}`,
                });
            }

            // Determine source
            const multerFile = (req as any).file as Express.Multer.File | undefined;
            const sheetUrl = req.body.sheet_url as string | undefined;

            if (!multerFile && !sheetUrl) {
                return res.status(400).json({
                    error: 'Provide either a CSV file upload or sheet_url',
                });
            }

            const source: 'upload' | 'sheet_url' = multerFile ? 'upload' : 'sheet_url';
            const sourceRef = multerFile
                ? multerFile.originalname
                : (sheetUrl as string);

            // 1. Parse
            const rawRows = await ContentImportService.parseSource(
                { file: multerFile?.buffer, sheetUrl },
                contentType
            );

            if (rawRows.length === 0) {
                return res.status(400).json({ error: 'No rows found in CSV' });
            }

            // 2. Validate
            const validatedRows = await ContentImportService.validateRows(rawRows, contentType);

            // 3. Stage (write to import tables only)
            const staged = await ContentImportService.stageBatch(
                contentType,
                source,
                sourceRef,
                adminId,
                validatedRows
            );

            res.status(201).json(staged);
        } catch (error: any) {
            logger.error('Content import error:', error);
            res.status(500).json({ error: error.message || 'Failed to import content' });
        }
    }

    // ──────────────────────────────────────────────────────────
    // GET /api/admin/content/import/history
    // Query params: content_type?, page?
    // ──────────────────────────────────────────────────────────
    static async getHistory(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            const contentType = req.query.content_type as string | undefined;

            let query = supabase
                .from('content_import_batches')
                .select(
                    '*, uploader:uploaded_by(email, full_name)',
                    { count: 'exact' }
                )
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (contentType && isValidContentType(contentType)) {
                query = query.eq('content_type', contentType);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            res.json({
                batches: data || [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit),
                },
            });
        } catch (error: any) {
            logger.error('Content import history error:', error);
            res.status(500).json({ error: 'Failed to load import history' });
        }
    }

    // ──────────────────────────────────────────────────────────
    // GET /api/admin/content/import/:batchId
    // Full row-level detail for a batch.
    // ──────────────────────────────────────────────────────────
    static async getBatch(req: Request, res: Response) {
        try {
            const batchId = String(req.params.batchId);

            const { data: batch, error: batchErr } = await supabase
                .from('content_import_batches')
                .select('*, uploader:uploaded_by(email, full_name)')
                .eq('id', batchId)
                .single();

            if (batchErr || !batch) {
                return res.status(404).json({ error: 'Batch not found' });
            }

            const { data: rows, error: rowsErr } = await supabase
                .from('content_import_rows')
                .select('*')
                .eq('batch_id', batchId)
                .order('row_number', { ascending: true });

            if (rowsErr) throw rowsErr;

            res.json({ batch, rows: rows || [] });
        } catch (error: any) {
            logger.error('Get batch error:', error);
            res.status(500).json({ error: 'Failed to get batch' });
        }
    }

    // ──────────────────────────────────────────────────────────
    // PATCH /api/admin/content/import/:batchId/rows/:rowId
    // Admin edits one row's raw_data inline, re-runs validation
    // on just that row, and updates status + errors.
    // ──────────────────────────────────────────────────────────
    static async updateRow(req: Request, res: Response) {
        try {
            const batchId = String(req.params.batchId);
            const rowId = String(req.params.rowId);
            const { raw_data } = req.body;

            if (!raw_data || typeof raw_data !== 'object') {
                return res.status(400).json({ error: 'raw_data object is required' });
            }

            // Load batch to know content_type
            const { data: batch, error: batchErr } = await supabase
                .from('content_import_batches')
                .select('content_type, status')
                .eq('id', batchId)
                .single();

            if (batchErr || !batch) {
                return res.status(404).json({ error: 'Batch not found' });
            }

            if (batch.status === 'published') {
                return res.status(409).json({ error: 'Cannot edit a published batch' });
            }

            // Re-validate just this one row
            const [validated] = await ContentImportService.validateRows(
                [raw_data],
                batch.content_type as ContentType
            );

            const { data: updated, error: updateErr } = await supabase
                .from('content_import_rows')
                .update({
                    raw_data: validated.row,
                    status: validated.status,
                    errors: validated.errors,
                })
                .eq('id', rowId)
                .eq('batch_id', batchId)
                .select('*')
                .single();

            if (updateErr || !updated) {
                return res.status(404).json({ error: 'Row not found' });
            }

            // Recompute and update batch-level counts
            const { data: allRows } = await supabase
                .from('content_import_rows')
                .select('status')
                .eq('batch_id', batchId);

            const validCount = (allRows || []).filter((r) => r.status === 'valid').length;
            const errorCount = (allRows || []).filter((r) => r.status === 'error').length;

            await supabase
                .from('content_import_batches')
                .update({ valid_rows: validCount, error_rows: errorCount })
                .eq('id', batchId);

            res.json(updated);
        } catch (error: any) {
            logger.error('Update row error:', error);
            res.status(500).json({ error: 'Failed to update row' });
        }
    }

    // ──────────────────────────────────────────────────────────
    // POST /api/admin/content/import/:batchId/publish
    // Body: { force?: boolean } — when force=true, warning rows are also published.
    // ──────────────────────────────────────────────────────────
    static async publishBatch(req: Request, res: Response) {
        try {
            const batchId = String(req.params.batchId);
            const force = req.body.force === true;

            const result = await ContentImportService.publishBatch(batchId, force);
            res.json(result);
        } catch (error: any) {
            logger.error('Publish batch error:', error);
            if (error.message === 'Batch not found') {
                return res.status(404).json({ error: error.message });
            }
            if (error.message === 'Batch already published') {
                return res.status(409).json({ error: error.message });
            }
            res.status(500).json({ error: error.message || 'Failed to publish batch' });
        }
    }

    // ──────────────────────────────────────────────────────────
    // GET /api/admin/content/templates/:contentType
    // Returns a text/csv file download with header + one example row.
    // ──────────────────────────────────────────────────────────
    static async downloadTemplate(req: Request, res: Response) {
        try {
            const contentType = String(req.params.contentType);

            if (!isValidContentType(contentType)) {
                return res.status(400).json({
                    error: `contentType must be one of: ${VALID_CONTENT_TYPES.join(', ')}`,
                });
            }

            const csv = ContentImportService.generateTemplate(contentType);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${contentType}-template.csv"`
            );
            res.send(csv);
        } catch (error: any) {
            logger.error('Template download error:', error);
            res.status(500).json({ error: 'Failed to generate template' });
        }
    }
}
