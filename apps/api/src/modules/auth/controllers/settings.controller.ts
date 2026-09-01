import { Request, Response } from 'express';
import { supabase, pool } from '../../../config/database';
import logger from '../../../config/logger';
import { CacheService } from '../../core/services/cache.service';

const PUBLIC_SETTINGS_CACHE_KEY = 'settings:public';
const PUBLIC_SETTINGS_CACHE_TTL = 300; // 5 minutes

export class SettingsController {
    /**
     * GET /api/settings/public
     */
    static async getPublicSettings(req: Request, res: Response) {
        try {
            // Serve from cache when available — avoids a DB round-trip on every page load
            const cached = await CacheService.get<Record<string, unknown>>(PUBLIC_SETTINGS_CACHE_KEY);
            if (cached) {
                return res.json(cached);
            }

            // Fetch keys that are allowed to be public
            const publicKeys = [
                'onboarding_steps',
                'app_quick_actions',
                'ai_quick_actions',
                'referral_reward_amount',
                'catalog_layout',
                'gamification_config',
                'hero_title',
                'hero_subtitle',
                'primary_color',
                'trending_categories',
                'features_json'
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

            // Cache for TTL — fire-and-forget
            CacheService.set(PUBLIC_SETTINGS_CACHE_KEY, config, PUBLIC_SETTINGS_CACHE_TTL).catch(() => {});

            res.json(config);
        } catch (error) {
            logger.error('Get public settings error:', error);
            res.status(500).json({ error: 'Failed to fetch public settings' });
        }
    }
}
