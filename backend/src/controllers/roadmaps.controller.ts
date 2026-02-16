import { Request, Response } from 'express';
import { RoadmapsService } from '../services/roadmaps.service';
import logger from '../config/logger';

export class RoadmapsController {
    /**
     * GET /api/roadmaps
     */
    static async listRoadmaps(req: Request, res: Response) {
        try {
            const roadmaps = await RoadmapsService.listRoadmaps();
            res.json(roadmaps);
        } catch (error) {
            logger.error('List roadmaps error:', error);
            res.status(500).json({ error: 'Failed to list roadmaps' });
        }
    }

    /**
     * GET /api/roadmaps/:idOrSlug
     */
    static async getRoadmap(req: Request, res: Response) {
        try {
            const roadmap = await RoadmapsService.getRoadmap(req.params.idOrSlug as string);
            res.json(roadmap);
        } catch (error) {
            logger.error('Get roadmap error:', error);
            res.status(500).json({ error: 'Failed to get roadmap' });
        }
    }
}
