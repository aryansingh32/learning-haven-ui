import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);

/**
 * @route   POST /api/feedback
 * @desc    Submit feedback
 * @access  Private
 */
router.post('/', FeedbackController.submitFeedback);

/**
 * @route   GET /api/feedback
 * @desc    Get user's own feedback
 * @access  Private
 */
router.get('/', FeedbackController.getUserFeedback);

export default router;
