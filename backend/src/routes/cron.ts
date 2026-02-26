import { Router } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';

const router = Router();

/**
 * @route   POST /api/cron/replenish-tokens
 * @desc    Monthly cron to replenish skip tokens based on plan
 * @access  Secured via x-cron-secret header
 */
router.post('/replenish-tokens', async (req, res) => {
    try {
        const headerSecret = req.headers['x-cron-secret'];
        const expected = process.env.CRON_SECRET;

        if (!expected || headerSecret !== expected) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const plans: Array<{ plan: string; tokens: number }> = [
            { plan: 'free', tokens: 0 },
            { plan: 'basic', tokens: 2 },
            { plan: 'standard', tokens: 4 },
            { plan: 'pro', tokens: 10 },
        ];

        for (const { plan, tokens } of plans) {
            const { error } = await supabase
                .from('users')
                .update({ skip_tokens_remaining: tokens })
                .eq('current_plan', plan);

            if (error) {
                throw error;
            }
        }

        return res.json({ success: true });
    } catch (error: any) {
        logger.error('Replenish tokens cron error:', { error });
        return res.status(500).json({ error: error.message || 'Failed to replenish tokens' });
    }
});

export default router;

