import { Router } from 'express';
import { EntitlementsController } from './entitlements.controller';
import { authenticateUser } from '../../middleware/auth';

const router = Router();

/**
 * @route   GET /api/entitlements/check?feature=ai_queries_per_day
 * @desc    Check if user has a specific entitlement
 * @access  Private
 */
router.get('/check', authenticateUser, EntitlementsController.checkFeature);

/**
 * @route   GET /api/entitlements/map
 * @desc    Get all entitlements for the authenticated user
 * @access  Private
 */
router.get('/map', authenticateUser, EntitlementsController.getEntitlementMap);

export default router;
