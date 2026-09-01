import { Router, Response } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { requireAndConsumeEntitlement } from '../../entitlements/entitlements.middleware';
import { MockTestService } from '../services/mock-test.service';
import logger from '../../../config/logger';

const router = Router();

/**
 * POST /api/mock-test/course/:courseId/start
 * Starts a new timed mock test pulling questions from the course's quiz pool.
 * Rate-limited via mock_test_attempts_per_day (free: 1/day, paid: unlimited).
 */
router.post(
    '/course/:courseId/start',
    authenticateUser,
    requireAndConsumeEntitlement('mock_test_attempts_per_day'),
    async (req: any, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const result = await MockTestService.startMockTest(userId, req.params.courseId);
            return res.json(result);
        } catch (err: any) {
            logger.error('Start mock test error', err);
            if (err.message === 'Course not found') {
                return res.status(404).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message || 'Failed to start mock test' });
        }
    }
);

/**
 * POST /api/mock-test/:testId/submit
 */
router.post('/:testId/submit', authenticateUser, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { answers } = req.body;
        const result = await MockTestService.submitMockTest(userId, req.params.testId, answers || []);
        return res.json(result);
    } catch (err: any) {
        logger.error('Submit mock test error', err);
        if (err.message === 'Mock test not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(400).json({ error: err.message || 'Failed to submit mock test' });
    }
});

/**
 * GET /api/mock-test/course/:courseId/latest
 */
router.get('/course/:courseId/latest', authenticateUser, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await MockTestService.getLatestMockTest(userId, req.params.courseId);
        return res.json(result);
    } catch (err) {
        logger.error('Get latest mock test error', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
