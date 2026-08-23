import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { ChaptersService } from '../services/chapters.service';
import logger from '../../../config/logger';
import { pool } from '../../../config/database';

const router = Router();

/**
 * POST /api/chapters/:chapterId/quiz/check
 * BUG-014 fix: Server-side quiz answer validation.
 * Client sends { questionIndex, selectedIndex } and gets back { correct, explanation }
 * WITHOUT the correct answer index being exposed.
 */
router.post('/:chapterId/quiz/check', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { questionIndex, selectedIndex } = req.body;

        if (typeof questionIndex !== 'number' || typeof selectedIndex !== 'number') {
            return res.status(400).json({ error: 'questionIndex and selectedIndex must be numbers' });
        }

        // Fetch quiz questions from DB (with correct answers — never sent to client)
        const contentResult = await pool.query(
            'SELECT quiz_questions FROM public.chapter_content WHERE chapter_id = $1',
            [chapterId]
        );

        if (!contentResult.rows[0]?.quiz_questions) {
            return res.status(404).json({ error: 'Quiz not found for this chapter' });
        }

        let questions = contentResult.rows[0].quiz_questions;
        if (typeof questions === 'string') questions = JSON.parse(questions);

        const question = questions[questionIndex];
        if (!question) {
            return res.status(400).json({ error: 'Question index out of range' });
        }

        // Resolve correct answer (supports multiple field names)
        const correctIndex = question.answer ?? question.correctAnswer ?? question.correct_answer ?? question.correct_index ?? question.correctIndex;

        const isCorrect = selectedIndex === correctIndex;

        return res.json({
            correct: isCorrect,
            explanation: question.explanation || '',
            // Only reveal the correct option text (not its index) when wrong
            correctOption: !isCorrect ? (question.options?.[correctIndex] ?? null) : null,
        });
    } catch (err) {
        logger.error('Quiz check error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


/**
 * POST /api/chapters/:chapterId/progress/quiz
 */
router.post('/:chapterId/progress/quiz', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { score, passed, total_questions } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await ChaptersService.updateQuizProgress(userId, chapterId, score, passed, total_questions);
        return res.json(result);
    } catch (err: any) {
        logger.error('Quiz progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/task
 * Submit a completed task response. Persists the learner's written answer.
 */
router.post('/:chapterId/progress/task', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        // BH-009: Read `notes` from request body — was previously never passed to the service
        const { notes } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await ChaptersService.updateTaskProgress(userId, chapterId, notes);
        return res.json(result);
    } catch (err) {
        logger.error('Task progress POST error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/chapters/:chapterId/progress/task/draft
 * Auto-save a task draft without submitting. Safe to call on every keystroke (debounced client-side).
 */
router.post('/:chapterId/progress/task/draft', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const { draft } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (typeof draft !== 'string') return res.status(400).json({ error: 'Missing draft string' });

        const result = await ChaptersService.saveTaskDraft(userId, chapterId, draft);
        return res.json(result);
    } catch (err) {
        logger.error('Task draft POST error', err);
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

/**
 * GET /api/chapters/:chapterId/celebration
 */
router.get('/:chapterId/celebration', authenticateUser, async (req: any, res: Response) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const data = await ChaptersService.getCelebrationSummary(userId, chapterId);
        return res.json(data);
    } catch (err: any) {
        logger.error('Celebration GET error', err);
        if (err.message === 'Chapter not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

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

        return res.json({
            chapter: data.chapter,
            course: data.course,
            content: data.content,
            progress: data.progress,
            celebration: data.celebration,
            user: data.user,
        });
    } catch (err: any) {
        logger.error('Chapter GET error', err);
        if (err.message === 'Chapter not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

export default router;
