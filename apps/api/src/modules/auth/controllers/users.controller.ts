import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { UsersService } from '../services/users.service';
import logger from '../../../config/logger';
import { InsightsService } from '../services/insights.service';
import { ReadinessService } from '../services/readiness.service';

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

            if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
                return res.status(400).json({ error: 'Invalid seconds value' });
            }

            const counted = await InsightsService.addStudyTime(user_id, seconds);
            const result = await UsersService.updateStudyTime(user_id, counted);
            res.json(result);
        } catch (error) {
            logger.error('Update study time error:', error);
            res.status(500).json({ error: 'Failed to update study time' });
        }
    }

    /**
     * GET /api/users/me/insights
     */
    /** GET /api/users/me/readiness — placement readiness computed on the server, with its parts and trend. */
    static async getReadiness(req: Request, res: Response) {
        try {
            res.json(await ReadinessService.get((req as AuthRequest).user!.id));
        } catch (error) {
            logger.error('Get readiness error:', error);
            res.status(500).json({ error: 'Failed to work out your readiness' });
        }
    }

    static async getInsights(req: Request, res: Response) {
        try {
            res.json(await InsightsService.get((req as AuthRequest).user!.id));
        } catch (error) {
            logger.error('Get insights error:', error);
            res.status(500).json({ error: 'Failed to load your dashboard' });
        }
    }

    /**
     * PUT /api/users/me/goals
     */
    static async updateGoals(req: Request, res: Response) {
        const body = req.body ?? {};
        const intOrNull = (v: unknown, min: number, max: number) =>
            v === null || (Number.isInteger(v) && (v as number) >= min && (v as number) <= max);
        if (body.daily_minutes !== undefined && !intOrNull(body.daily_minutes, 5, 600)) {
            return res.status(400).json({ error: 'Daily goal must be 5 to 600 minutes' });
        }
        if (body.weekly_problems !== undefined && !intOrNull(body.weekly_problems, 1, 100)) {
            return res.status(400).json({ error: 'Weekly goal must be 1 to 100 problems' });
        }
        if (body.learning_goal !== undefined && body.learning_goal !== null &&
            (typeof body.learning_goal !== 'string' || body.learning_goal.trim().length === 0 || body.learning_goal.length > 200)) {
            return res.status(400).json({ error: 'Your goal can be up to 200 characters' });
        }
        try {
            res.json(await InsightsService.updateGoals((req as AuthRequest).user!.id, {
                daily_minutes: body.daily_minutes,
                weekly_problems: body.weekly_problems,
                learning_goal: typeof body.learning_goal === 'string' ? body.learning_goal.trim() : body.learning_goal,
            }));
        } catch (error) {
            logger.error('Update goals error:', error);
            res.status(500).json({ error: 'Failed to save your goals' });
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

