import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SubmissionsService } from '../services/submissions.service';
import logger from '../config/logger';

export class SubmissionsController {
    /**
     * POST /api/problems/:id/submit
     */
    static async submitSolution(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const problem_id = req.params.id as string;
            const { code, language, time_spent_seconds } = req.body;

            const result = await SubmissionsService.submitSolution(
                user_id,
                problem_id,
                code,
                language,
                time_spent_seconds
            );

            res.status(201).json(result);
        } catch (error) {
            logger.error('Submit solution error:', error);
            res.status(500).json({ error: 'Failed to submit solution' });
        }
    }

    /**
     * POST /api/submissions/:id/notes
     */
    static async addNotes(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const problem_id = req.params.id as string;
            const { notes } = req.body;

            const submission = await SubmissionsService.addNotes(user_id, problem_id, notes);

            res.json(submission);
        } catch (error) {
            logger.error('Add notes error:', error);
            res.status(500).json({ error: 'Failed to add notes' });
        }
    }

    /**
     * POST /api/submissions/:id/revision
     */
    static async toggleRevision(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const problem_id = req.params.id as string;

            const submission = await SubmissionsService.toggleRevision(user_id, problem_id);

            res.json(submission);
        } catch (error) {
            logger.error('Toggle revision error:', error);
            res.status(500).json({ error: 'Failed to toggle revision' });
        }
    }

    /**
     * GET /api/leaderboard
     */
    static async getLeaderboard(req: Request, res: Response) {
        try {
            const limit = parseInt(req.query.limit as string) || 100;
            const leaderboard = await SubmissionsService.getLeaderboard(limit);

            res.json(leaderboard);
        } catch (error) {
            logger.error('Get leaderboard error:', error);
            res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
    }
}
