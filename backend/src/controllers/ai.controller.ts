import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AIService } from '../services/ai.service';
import logger from '../config/logger';

export class AIController {
    /**
     * POST /api/ai/chat
     */
    static async chat(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { message, problem_id } = req.body;

            const result = await AIService.chat(userId, message, problem_id);
            res.json(result);
        } catch (error: any) {
            logger.error('AI chat error:', error);

            if (error.message?.includes('limit reached')) {
                return res.status(429).json({ error: error.message });
            }

            res.status(500).json({ error: 'AI service temporarily unavailable' });
        }
    }

    /**
     * GET /api/ai/history
     */
    static async getHistory(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const limit = parseInt(req.query.limit as string) || 50;

            const history = await AIService.getChatHistory(userId, limit);
            res.json(history);
        } catch (error) {
            logger.error('AI history error:', error);
            res.status(500).json({ error: 'Failed to fetch chat history' });
        }
    }

    /**
     * DELETE /api/ai/history
     */
    static async clearHistory(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const result = await AIService.clearHistory(userId);
            res.json(result);
        } catch (error) {
            logger.error('Clear AI history error:', error);
            res.status(500).json({ error: 'Failed to clear chat history' });
        }
    }

    /**
     * GET /api/ai/usage
     */
    static async getUsage(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const usage = await AIService.getRemainingQueries(userId);
            res.json(usage);
        } catch (error) {
            logger.error('AI usage error:', error);
            res.status(500).json({ error: 'Failed to fetch usage info' });
        }
    }
}
