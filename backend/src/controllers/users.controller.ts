import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UsersService } from '../services/users.service';
import logger from '../config/logger';

export class UsersController {
    /**
     * GET /api/users/me
     */
    static async getProfile(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const profile = await UsersService.getProfile(user_id);
            res.json(profile);
        } catch (error) {
            logger.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to fetch profile' });
        }
    }

    /**
     * PUT /api/users/me
     */
    static async updateProfile(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const updates = req.body;

            const profile = await UsersService.updateProfile(user_id, updates);
            res.json(profile);
        } catch (error) {
            logger.error('Update profile error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }

    /**
     * GET /api/users/me/stats
     */
    static async getStats(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const stats = await UsersService.getStats(user_id);
            res.json(stats);
        } catch (error) {
            logger.error('Get stats error:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    }

    /**
     * GET /api/users/me/progress
     */
    static async getProgress(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const progress = await UsersService.getProgress(user_id);
            res.json(progress);
        } catch (error) {
            logger.error('Get progress error:', error);
            res.status(500).json({ error: 'Failed to fetch progress' });
        }
    }

    /**
     * POST /api/users/study-time
     */
    static async updateStudyTime(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const { seconds } = req.body;

            if (typeof seconds !== 'number' || seconds <= 0) {
                return res.status(400).json({ error: 'Invalid seconds value' });
            }

            const result = await UsersService.updateStudyTime(user_id, seconds);
            res.json(result);
        } catch (error) {
            logger.error('Update study time error:', error);
            res.status(500).json({ error: 'Failed to update study time' });
        }
    }

    /**
     * GET /api/users/analytics/activity
     */
    static async getActivityHeatmap(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const heatmap = await UsersService.getActivityHeatmap(user_id);
            res.json(heatmap);
        } catch (error) {
            logger.error('Get heatmap error:', error);
            res.status(500).json({ error: 'Failed to fetch heatmap' });
        }
    }

    /**
     * GET /api/users/analytics/radar
     */
    static async getSkillRadar(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const radar = await UsersService.getSkillRadar(user_id);
            res.json(radar);
        } catch (error) {
            logger.error('Get radar error:', error);
            res.status(500).json({ error: 'Failed to fetch radar data' });
        }
    }

    /**
     * GET /api/users/analytics/weekly
     */
    static async getWeeklyProgress(req: Request, res: Response) {
        try {
            const user_id = (req as AuthRequest).user!.id;
            const weekly = await UsersService.getWeeklyProgress(user_id);
            res.json(weekly);
        } catch (error) {
            logger.error('Get weekly stats error:', error);
            res.status(500).json({ error: 'Failed to fetch weekly stats' });
        }
    }
}

