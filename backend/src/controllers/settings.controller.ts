import { Request, Response } from 'express';
import { supabase, pool } from '../config/database';
import logger from '../config/logger';

export class SettingsController {
    /**
     * GET /api/settings/public
     */
    static async getPublicSettings(req: Request, res: Response) {
        try {
            // Fetch keys that are allowed to be public
            const publicKeys = [
                'onboarding_steps',
                'app_quick_actions',
                'ai_quick_actions',
                'referral_reward_amount'
            ];

            const result = await pool.query(
                'SELECT key, value FROM public.system_settings WHERE key = ANY($1)',
                [publicKeys]
            );
            const settings = result.rows;

            if (!settings) throw new Error('Settings not found');

            // Reduce to key-value object
            const config = settings.reduce((acc: any, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});

            res.json(config);
        } catch (error) {
            logger.error('Get public settings error:', error);
            res.status(500).json({ error: 'Failed to fetch public settings' });
        }
    }
}
