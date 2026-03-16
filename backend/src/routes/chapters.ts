import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { ChaptersService } from '../services/chapters.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/chapters/:chapterId
 * Fetch chapter + chapter_content from Supabase.
 * Also fetch user_chapter_progress for this user + chapter.
 * If no progress row exists: create one with status='LOCKED' (or UNLOCKED for ch1).
 */
router.get('/:chapterId', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = await ChaptersService.getChapterWithProgress(userId, chapterId);

        // Reformat chapter content slightly if it's an array
        if (Array.isArray(data.content) && data.content.length > 0) {
            data.content = data.content[0];
        } else if (Array.isArray(data.content) && data.content.length === 0) {
            data.content = null;
        }

        return res.json({
            chapter: {
                ...data.chapter,
                content: undefined // Remove content array from root if it exists
            },
            content: data.content,
            progress: data.progress
        });
    } catch (err: any) {
        logger.error('Chapter GET error', err);
        if (err.message === 'Chapter not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/quiz
 */
router.post('/:chapterId/progress/quiz', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { score, passed } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await ChaptersService.updateQuizProgress(userId, chapterId, score, passed);
        return res.json(result);
    } catch (err: any) {
        logger.error('Quiz progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/task
 */
router.post('/:chapterId/progress/task', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await ChaptersService.updateTaskProgress(userId, chapterId);
        return res.json(result);
    } catch (err) {
        logger.error('Task progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/step
 */
router.post('/:chapterId/progress/step', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { step_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!step_id) return res.status(400).json({ error: 'Missing step_id' });

        const result = await ChaptersService.updateStepProgress(userId, chapterId, step_id);
        return res.json(result);
    } catch (err) {
        logger.error('Step progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/unlock
 */
router.post('/unlock', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapter_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!chapter_id) return res.status(400).json({ error: 'Missing chapter_id' });

        const result = await ChaptersService.unlockChapter(userId, chapter_id);

        if (result.error) {
            return res.status(result.statusCode || 400).json(result);
        }

        return res.json(result);
    } catch (err: any) {
        logger.error('Unlock POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/skip-unlock
 */
router.post('/skip-unlock', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapter_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!chapter_id) return res.status(400).json({ error: 'Missing chapter_id' });

        const result = await ChaptersService.skipUnlockChapter(userId, chapter_id);

        if (result.error) {
            return res.status(result.statusCode || 400).json(result);
        }

        return res.json(result);
    } catch (err) {
        logger.error('Skip-unlock POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
