import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { GamificationService } from '../services/gamification.service';
import logger from '../../../config/logger';

export class GamificationController {
    static async getMission(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const mission = await GamificationService.getMission(userId);
            res.json(mission);
        } catch (error) {
            logger.error('Get mission error:', error);
            res.status(500).json({ error: 'Failed to fetch mission' });
        }
    }

    static async getDailyQuests(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const quests = await GamificationService.getDailyQuests(userId);
            res.json(quests);
        } catch (error) {
            logger.error('Get daily quests error:', error);
            res.status(500).json({ error: 'Failed to fetch daily quests' });
        }
    }

    static async completeDailyQuest(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { questKey } = req.body;
            if (!questKey) {
                return res.status(400).json({ error: 'questKey is required' });
            }
            const quests = await GamificationService.completeDailyQuest(userId, questKey);
            res.json(quests);
        } catch (error) {
            logger.error('Complete daily quest error:', error);
            res.status(500).json({ error: 'Failed to complete quest' });
        }
    }

    static async getIdentity(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const identity = await GamificationService.getIdentity(userId);
            res.json(identity);
        } catch (error) {
            logger.error('Get identity error:', error);
            res.status(500).json({ error: 'Failed to fetch identity' });
        }
    }

    static async getMentorContext(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const context = await GamificationService.getMentorContext(userId);
            res.json(context);
        } catch (error) {
            logger.error('Get mentor context error:', error);
            res.status(500).json({ error: 'Failed to fetch mentor context' });
        }
    }
}
