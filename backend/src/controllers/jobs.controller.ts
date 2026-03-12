import { Request, Response } from 'express';
import { JobsService } from '../services/jobs.service';
import logger from '../config/logger';

export class JobsController {
    static async getJobs(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const type = req.query.type as string | undefined;

            const result = await JobsService.listJobs({ type, page, limit });
            // To maintain compatibility with user expectations `{ jobs: [], total: number }`
            // and using our pagination structure
            res.json({
                jobs: result.jobs,
                total: result.pagination.total,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Get jobs error:', error);
            res.status(500).json({ error: 'Failed to fetch jobs' });
        }
    }

    static async getLatestJobs(req: Request, res: Response) {
        try {
            const limit = parseInt(req.query.limit as string) || 3;
            const jobs = await JobsService.getLatestJobs(limit);
            res.json(jobs);
        } catch (error) {
            logger.error('Get latest jobs error:', error);
            res.status(500).json({ error: 'Failed to fetch latest jobs' });
        }
    }
}
