import { Router } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';
import { WhatsAppService } from '../services/whatsapp.service';

const router = Router();

const verifyCronSecret = (req: any, res: any): boolean => {
    const headerSecret = req.headers['x-cron-secret'];
    const expected = process.env.CRON_SECRET;
    if (!expected || headerSecret !== expected) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
};

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

/**
 * @route   GET /api/cron/expire-jobs
 * @desc    Daily cron to expire jobs that have passed their deadline
 * @access  Secured via x-cron-secret header
 */
router.get('/expire-jobs', async (req, res) => {
    try {
        const headerSecret = req.headers['x-cron-secret'];
        const expected = process.env.CRON_SECRET;

        if (!expected || headerSecret !== expected) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { error, count } = await supabase
            .from('job_alerts')
            .update({ is_active: false })
            .lt('deadline', new Date().toISOString())
            .not('deadline', 'is', null)
            .eq('is_active', true)
            .select();

        if (error) throw error;

        return res.json({ success: true, expiredCount: count || 0 });
    } catch (error: any) {
        logger.error('Expire jobs cron error:', { error });
        return res.status(500).json({ error: error.message || 'Failed to expire jobs' });
    }
});

/**
 * @route   POST /api/cron/whatsapp-morning
 * @desc    8 AM: Send personalized morning task reminder to all opted-in users
 * @access  Secured via x-cron-secret header
 */
router.post('/whatsapp-morning', async (req, res) => {
    if (!verifyCronSecret(req, res)) return;
    res.json({ success: true, message: 'Morning reminders queued' });
    await WhatsAppService.sendMorningReminders();
});

/**
 * @route   POST /api/cron/whatsapp-jobs
 * @desc    2 PM: Send afternoon job alert to all opted-in users
 * @access  Secured via x-cron-secret header
 */
router.post('/whatsapp-jobs', async (req, res) => {
    if (!verifyCronSecret(req, res)) return;
    res.json({ success: true, message: 'Job alerts queued' });
    await WhatsAppService.sendAfternoonJobAlerts();
});

/**
 * @route   POST /api/cron/whatsapp-checkin
 * @desc    8 PM: Send evening check-in message to all opted-in users
 * @access  Secured via x-cron-secret header
 */
router.post('/whatsapp-checkin', async (req, res) => {
    if (!verifyCronSecret(req, res)) return;
    res.json({ success: true, message: 'Check-in messages queued' });
    await WhatsAppService.sendEveningCheckin();
});

export default router;
