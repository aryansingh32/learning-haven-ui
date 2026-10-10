import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env';
import { requireSuperAdmin } from '../../../middleware/requireAdmin';
import { QueuesService } from '../services/queues.service';
import { emailStatus, sendTestEmail } from '../../communication/services/email.service';

/**
 * Admin operations (mounted at /admin/ops, behind requireAdmin): background job
 * queues, email set-up and a test send, and which integrations are configured.
 */
const router = Router();

const handle = (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
    try {
        res.json(await fn(req));
    } catch (error: any) {
        if (error?.status === 404) return res.status(404).json({ error: error.message });
        if (/ECONNREFUSED|Connection is closed|ETIMEDOUT/i.test(String(error?.message))) {
            return res.status(503).json({ error: 'The job queue (Redis) is not reachable' });
        }
        throw error;
    }
};

router.get('/queues', handle(() => QueuesService.overview()));
router.get('/queues/:name/jobs', handle((req) => QueuesService.jobs(req.params.name,
    (['failed', 'waiting', 'active', 'delayed', 'completed'].includes(req.query.state) ? req.query.state : 'failed'))));
router.post('/queues/:name/retry', requireSuperAdmin, handle((req) =>
    QueuesService.retry(req.params.name, typeof req.body?.jobId === 'string' ? req.body.jobId : undefined)));
router.post('/queues/:name/clean', requireSuperAdmin, handle((req) =>
    QueuesService.clean(req.params.name, req.body?.state === 'completed' ? 'completed' : 'failed')));
router.post('/queues/:name/pause', requireSuperAdmin, handle((req) => QueuesService.setPaused(req.params.name, req.body?.paused !== false)));

router.get('/email', handle(async () => emailStatus()));
router.post('/email/test', requireSuperAdmin, async (req: any, res) => {
    const to = z.string().email().safeParse(req.body?.to ?? req.user?.email);
    if (!to.success) return res.status(400).json({ error: 'Enter an email address' });
    res.json(await sendTestEmail(to.data));
});

/** Which outside services are set up (server environment), never the values. */
router.get('/integrations', (_req, res) => {
    const set = (v: unknown) => Boolean(v);
    res.json([
        { key: 'database', label: 'Database (Supabase)', configured: set(env.SUPABASE_URL) },
        { key: 'redis', label: 'Redis (cache, queues)', configured: set(env.REDIS_URL) },
        { key: 'razorpay', label: 'Razorpay (payments)', configured: set(env.RAZORPAY_KEY_ID) && set(env.RAZORPAY_KEY_SECRET), mode: String(env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_live') ? 'live' : 'test' },
        { key: 'resend', label: 'Resend (email)', configured: set(process.env.RESEND_API_KEY) },
        { key: 'judge0', label: 'Judge0 (code runner)', configured: set(env.JUDGE0_URL) },
        { key: 'github', label: 'GitHub app (project checks)', configured: set(env.GITHUB_CLIENT_ID) },
        { key: 'openrouter', label: 'OpenRouter (AI)', configured: set(env.OPENROUTER_API_KEY) },
        { key: 'openai', label: 'OpenAI (AI)', configured: set(env.OPENAI_API_KEY) },
        { key: 'whatsapp', label: 'WhatsApp', configured: set(process.env.WHATSAPP_TOKEN ?? process.env.WHATSAPP_ACCESS_TOKEN) },
        { key: 'sentry', label: 'Sentry (errors)', configured: set(process.env.SENTRY_DSN) },
    ]);
});

export default router;
