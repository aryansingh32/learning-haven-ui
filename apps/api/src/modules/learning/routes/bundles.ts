import { Router } from 'express';
import { optionalAuth } from '../../../middleware/auth';
import logger from '../../../config/logger';
import { BundlesService } from '../services/bundles.service';

const router = Router();

/**
 * @route   GET /api/bundles
 * @desc    Published course bundles; signed-in learners also see which courses they own
 * @access  Public
 */
router.get('/', optionalAuth, async (req: any, res) => {
    try {
        res.json(await BundlesService.list(req.user?.id));
    } catch (error) {
        logger.error('List bundles error:', error);
        res.status(500).json({ error: 'Failed to load bundles' });
    }
});

/**
 * @route   GET /api/bundles/:slug
 * @access  Public
 */
router.get('/:slug', optionalAuth, async (req: any, res) => {
    try {
        const [bundle] = await BundlesService.list(req.user?.id, String(req.params.slug).slice(0, 100));
        if (!bundle) return res.status(404).json({ error: 'Bundle not found' });
        res.json(bundle);
    } catch (error) {
        logger.error('Get bundle error:', error);
        res.status(500).json({ error: 'Failed to load the bundle' });
    }
});

export default router;
