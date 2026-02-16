import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FeedbackService } from '../services/feedback.service';
import logger from '../config/logger';

export class FeedbackController {
    /**
     * POST /api/feedback
     */
    static async submitFeedback(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const feedback = await FeedbackService.submitFeedback(userId, req.body);
            res.status(201).json(feedback);
        } catch (error) {
            logger.error('Submit feedback error:', error);
            res.status(500).json({ error: 'Failed to submit feedback' });
        }
    }

    /**
     * GET /api/feedback
     */
    static async getUserFeedback(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const feedback = await FeedbackService.getUserFeedback(userId);
            res.json(feedback);
        } catch (error) {
            logger.error('Get user feedback error:', error);
            res.status(500).json({ error: 'Failed to get feedback' });
        }
    }
}
