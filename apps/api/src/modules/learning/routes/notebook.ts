import { Router, Response } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { requireEntitlement } from '../../entitlements/entitlements.middleware';
import { NotebookService } from '../services/notebook.service';
import logger from '../../../config/logger';

const router = Router();

/**
 * GET /api/notebook/course/:courseId
 * Aggregated notebook (notes + quiz scores + task responses) for a course.
 */
router.get('/course/:courseId', authenticateUser, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const notebook = await NotebookService.getCourseNotebook(userId, req.params.courseId);
        return res.json(notebook);
    } catch (err: any) {
        logger.error('Get notebook error', err);
        if (err.message === 'Course not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/notebook/course/:courseId/export
 * Renders the notebook as a branded PDF. Gated behind notebook_pdf_export entitlement.
 */
router.post(
    '/course/:courseId/export',
    authenticateUser,
    requireEntitlement('notebook_pdf_export'),
    async (req: any, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const result = await NotebookService.exportCourseNotebookPdf(userId, req.params.courseId);
            return res.json(result);
        } catch (err: any) {
            logger.error('Export notebook PDF error', err);
            if (err.message === 'Course not found') {
                return res.status(404).json({ error: err.message });
            }
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

/**
 * GET /api/notebook/chapter/:chapterId/notes
 */
router.get('/chapter/:chapterId/notes', authenticateUser, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const notes = await NotebookService.getChapterNotes(userId, req.params.chapterId);
        return res.json(notes);
    } catch (err) {
        logger.error('Get chapter notes error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/notebook/chapter/:chapterId/notes
 */
router.put('/chapter/:chapterId/notes', authenticateUser, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { content } = req.body;
        if (typeof content !== 'string') {
            return res.status(400).json({ error: 'Missing content string' });
        }

        const result = await NotebookService.saveChapterNotes(userId, req.params.chapterId, content);
        return res.json(result);
    } catch (err: any) {
        logger.error('Save chapter notes error', err);
        if (err.message === 'Chapter not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/notebook/chapter/:chapterId/notes/append
 * Appends a highlighted excerpt (or full doc) into the learner's chapter
 * notes. Gated behind notebook_edit_access — premium notebook feature.
 */
router.post(
    '/chapter/:chapterId/notes/append',
    authenticateUser,
    requireEntitlement('notebook_edit_access'),
    async (req: any, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { text, source_title } = req.body;
            if (typeof text !== 'string' || !text.trim()) {
                return res.status(400).json({ error: 'Missing text string' });
            }

            const result = await NotebookService.appendChapterHighlight(userId, req.params.chapterId, text, source_title);
            return res.json(result);
        } catch (err: any) {
            logger.error('Append chapter highlight error', err);
            if (err.message === 'Chapter not found') {
                return res.status(404).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message || 'Failed to add highlight' });
        }
    }
);

export default router;
