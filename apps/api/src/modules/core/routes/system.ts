import { Router } from 'express';
import { optionalAuth } from '../../../middleware/auth';
import { ControlCentre } from '../services/controlCentre.service';

const router = Router();

/**
 * GET /api/system/status — what the apps need from the control centre: maintenance
 * mode, whether sign-ups are open, feature flags evaluated for this viewer, and the
 * announcements that apply to them. Works signed in or not; polled by the apps.
 */
router.get('/status', optionalAuth, async (req: any, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await ControlCentre.forViewer(req.user?.id));
});

export default router;
