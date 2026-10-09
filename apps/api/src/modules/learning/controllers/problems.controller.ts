import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ProblemsService } from '../services/problems.service';
import { hasPaidPlan } from './judge.controller';
import logger from '../../../config/logger';
import { cleanCompany, cleanSearch } from '../services/practiceHelpers';

export class ProblemsController {
    /**
     * GET /api/problems
     */
    static async getProblems(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user?.id;
            const { page, limit, difficulty, topic, search, company, is_premium } = req.query as any;

            const result = await ProblemsService.getProblems({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                difficulty,
                topic,
                search: cleanSearch(search),
                company: cleanCompany(company),
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
     * GET /api/problems/companies
     */
    static async getCompanies(_req: Request, res: Response) {
        try {
            res.json(await ProblemsService.getCompanies());
        } catch (error) {
            logger.error('Get problem companies error:', error);
            res.status(500).json({ error: 'Failed to fetch companies' });
        }
    }

    /**
     * GET /api/problems/daily
     */
    static async getDaily(req: Request, res: Response) {
        try {
            res.json(await ProblemsService.getDaily((req as AuthRequest).user?.id));
        } catch (error) {
            logger.error('Get daily problem error:', error);
            res.status(500).json({ error: 'Failed to fetch the daily problem' });
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
            // req.user carries no plan; read it from entitlements.
            const user_plan = (await hasPaidPlan((req as AuthRequest).user!.id)) ? 'paid' : 'free';

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
            // req.user carries no plan; read it from entitlements.
            const user_plan = (await hasPaidPlan((req as AuthRequest).user!.id)) ? 'paid' : 'free';

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
