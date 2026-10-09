import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { GamificationService } from '../services/gamification.service';
import { AchievementsService, ClaimError } from '../services/achievements.service';
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
            if (GamificationService.AUTO_VERIFIED_QUESTS.includes(questKey)) {
                // These complete themselves from real activity; marking them by hand would pay the bonus for nothing.
                return res.status(409).json({ error: 'This quest completes itself when you do it.', code: 'AUTO_VERIFIED' });
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

/** Weekly missions, coding streak, milestones, collections and the learner leaderboard (slice W2-G1). */
export class AchievementsController {
    static async get(req: Request, res: Response) {
        try {
            res.json(await AchievementsService.get((req as AuthRequest).user!.id));
        } catch (error) {
            logger.error('Get achievements error:', error);
            res.status(500).json({ error: 'Failed to load your achievements' });
        }
    }

    static async claimMission(req: Request, res: Response) {
        const key = String(req.params.key ?? '');
        if (!/^[a-z0-9_]{1,40}$/.test(key)) return res.status(400).json({ error: 'Unknown mission' });
        try {
            res.json(await AchievementsService.claimMission((req as AuthRequest).user!.id, key));
        } catch (error) {
            if (error instanceof ClaimError) return res.status(error.status).json({ error: error.message, code: error.code });
            logger.error('Claim mission error:', error);
            res.status(500).json({ error: 'Could not claim this mission' });
        }
    }

    static async leaderboard(req: Request, res: Response) {
        const p = req.query.period;
        const period = p === 'week' ? 'week' : p === undefined || p === 'all' ? 'all' : null;
        if (!period) return res.status(400).json({ error: 'period must be all or week' });
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
        try {
            res.json(await AchievementsService.leaderboard((req as AuthRequest).user!.id, period, limit));
        } catch (error) {
            logger.error('Get leaderboard error:', error);
            res.status(500).json({ error: 'Failed to load the leaderboard' });
        }
    }

    static async setLeaderboardVisibility(req: Request, res: Response) {
        if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be true or false' });
        try {
            res.json(await AchievementsService.setHidden((req as AuthRequest).user!.id, req.body.hidden));
        } catch (error) {
            if (error instanceof ClaimError) return res.status(error.status).json({ error: error.message, code: error.code });
            logger.error('Set leaderboard visibility error:', error);
            res.status(500).json({ error: 'Could not save your choice' });
        }
    }
}
