import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { ChaptersService } from '../services/chapters.service';

const router = Router();

/**
 * @route   GET /api/chapters/:chapterId
 * @desc    Get chapter with content and user progress
 * @access  Private
 */
router.get('/:chapterId', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { chapterId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await ChaptersService.getChapterWithProgress(userId, chapterId);

        return res.json({
            chapter: result.chapter,
            content: result.content,
            progress: result.progress,
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to fetch chapter' });
    }
});

/**
 * @route   GET /api/chapters/:chapterId/progress
 * @desc    Get user chapter progress
 * @access  Private
 */
router.get('/:chapterId/progress', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { chapterId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await ChaptersService.getChapterWithProgress(userId, chapterId);

        return res.json(result.progress);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to fetch chapter progress' });
    }
});

/**
 * @route   POST /api/chapters/:chapterId/progress/quiz
 * @desc    Update quiz progress for chapter
 * @access  Private
 */
router.post('/:chapterId/progress/quiz', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { chapterId } = req.params;
        const { score, passed } = req.body as { score: number; passed: boolean };

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (typeof score !== 'number' || score < 0) {
            return res.status(400).json({ error: 'Invalid score' });
        }

        const result = await ChaptersService.updateQuizProgress(userId, chapterId, score, !!passed);

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to update quiz progress' });
    }
});

/**
 * @route   POST /api/chapters/:chapterId/progress/task
 * @desc    Mark chapter task as completed
 * @access  Private
 */
router.post('/:chapterId/progress/task', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { chapterId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await ChaptersService.updateTaskProgress(userId, chapterId);

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to update task progress' });
    }
});

/**
 * @route   POST /api/chapters/unlock
 * @desc    Unlock next chapter
 * @access  Private
 */
router.post('/unlock', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { chapter_id } = req.body as { chapter_id: string };

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!chapter_id) {
            return res.status(400).json({ error: 'chapter_id is required' });
        }

        const result = await ChaptersService.unlockChapter(userId, chapter_id);

        if ('error' in result && (result as any).statusCode) {
            return res.status((result as any).statusCode).json(result);
        }

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to unlock chapter' });
    }
});

/**
 * @route   POST /api/chapters/skip-unlock
 * @desc    Use skip token to unlock next chapter
 * @access  Private
 */
router.post('/skip-unlock', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { chapter_id } = req.body as { chapter_id: string };

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!chapter_id) {
            return res.status(400).json({ error: 'chapter_id is required' });
        }

        const result = await ChaptersService.skipUnlockChapter(userId, chapter_id);

        if ('error' in result && (result as any).statusCode) {
            return res.status((result as any).statusCode).json(result);
        }

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to skip unlock chapter' });
    }
});

export default router;

