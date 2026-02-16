import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProblemsService } from '../services/problems.service';
import logger from '../config/logger';

export class ProblemsController {
    /**
     * GET /api/problems
     */
    static async getProblems(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user?.id;
            const { page, limit, difficulty, topic, search, is_premium } = req.query as any;

            const result = await ProblemsService.getProblems({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                difficulty,
                topic,
                search,
                is_premium: is_premium === 'true' ? true : is_premium === 'false' ? false : undefined,
                user_id,
            });

            res.json(result);
        } catch (error) {
            logger.error('Get problems error:', error);
            res.status(500).json({ error: 'Failed to fetch problems' });
        }
    }

    /**
     * GET /api/problems/:slug
     */
    static async getProblem(req: Request, res: Response) {
        try {
            const slug = req.params.slug as string;
            const user_id = (req as AuthRequest).user?.id;

            const problem = await ProblemsService.getProblemBySlug(slug, user_id);

            res.json(problem);
        } catch (error: any) {
            logger.error('Get problem error:', error);

            if (error.message === 'Problem not found') {
                return res.status(404).json({ error: 'Problem not found' });
            }

            res.status(500).json({ error: 'Failed to fetch problem' });
        }
    }

    /**
     * GET /api/problems/:id/hints
     */
    static async getHints(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const user_plan = (req as AuthRequest).user?.current_plan || 'free';

            const hints = await ProblemsService.getHints(id, user_plan);

            res.json(hints);
        } catch (error: any) {
            logger.error('Get hints error:', error);

            if (error.message === 'Premium subscription required') {
                return res.status(403).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to fetch hints' });
        }
    }

    /**
     * GET /api/problems/:id/solution
     */
    static async getSolution(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const user_plan = (req as AuthRequest).user?.current_plan || 'free';

            const solution = await ProblemsService.getSolution(id, user_plan);

            res.json(solution);
        } catch (error: any) {
            logger.error('Get solution error:', error);

            if (error.message === 'Premium subscription required') {
                return res.status(403).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to fetch solution' });
        }
    }
}
