import { Router } from 'express';
import { trackEvent, getNetworkAnalytics, updateRetention, getPublicStats } from '../controllers/analytics.controller';
import { authenticateUser } from '../../../middleware/auth';
import { requireAdmin } from '../../../middleware/requireAdmin';

const router = Router();

// Public routes
router.get('/public', getPublicStats);
router.post('/track', trackEvent);

// Admin routes for analytics dashboard
router.get('/network', authenticateUser, requireAdmin, getNetworkAnalytics);
router.post('/retention', authenticateUser, requireAdmin, updateRetention);

export default router;
