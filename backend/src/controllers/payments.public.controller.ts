import { Request, Response } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';

export class PublicPaymentsController {
    /**
     * GET /api/payments/plans
     * @desc Get all active pricing plans
     */
    static async getPlans(req: Request, res: Response) {
        try {
            const { data: plans, error } = await supabase
                .from('plans_config')
                .select('*')
                .eq('is_active', true)
                .order('order_index', { ascending: true });

            if (error) throw error;
            res.json(plans);
        } catch (error) {
            logger.error('Get plans error:', error);
            res.status(500).json({ error: 'Failed to fetch active plans' });
        }
    }
}
