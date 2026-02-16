import { Router } from 'express';
import { SubscriptionsController } from '../controllers/subscriptions.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', SubscriptionsController.getPlans);

/**
 * @route   GET /api/subscriptions/current
 * @desc    Get user's current subscription
 * @access  Private
 */
router.get('/current', authenticateUser, SubscriptionsController.getCurrentSubscription);

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel subscription at period end
 * @access  Private
 */
router.post('/cancel', authenticateUser, SubscriptionsController.cancelSubscription);

export default router;
