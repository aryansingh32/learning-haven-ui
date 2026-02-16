import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SubscriptionsService } from '../services/subscriptions.service';
import logger from '../config/logger';

export class SubscriptionsController {
    /**
     * GET /api/subscriptions/plans
     */
    static async getPlans(req: Request, res: Response) {
        try {
            const plans = SubscriptionsService.getPlans();
            res.json(plans);
        } catch (error) {
            logger.error('Get plans error:', error);
            res.status(500).json({ error: 'Failed to fetch plans' });
        }
    }

    /**
     * GET /api/subscriptions/current
     */
    static async getCurrentSubscription(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const subscription = await SubscriptionsService.getActiveSubscription(userId);

            res.json(subscription);
        } catch (error) {
            logger.error('Get subscription error:', error);
            res.status(500).json({ error: 'Failed to fetch subscription' });
        }
    }

    /**
     * POST /api/subscriptions/cancel
     */
    static async cancelSubscription(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const result = await SubscriptionsService.cancelSubscription(userId);

            res.json(result);
        } catch (error: any) {
            logger.error('Cancel subscription error:', error);

            if (error.message === 'No active subscription found') {
                return res.status(404).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    }
}
