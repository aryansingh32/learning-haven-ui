import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { authenticateUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../utils/validators';

const router = Router();

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateUser, UsersController.getProfile);

/**
 * @route   PUT /api/users/me
 * @desc    Update user profile
 * @access  Private
 */
router.put(
    '/me',
    authenticateUser,
    validate(updateProfileSchema),
    UsersController.updateProfile
);

/**
 * @route   GET /api/users/me/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/me/stats', authenticateUser, UsersController.getStats);

/**
 * @route   GET /api/users/me/progress
 * @desc    Get user progress by topic
 * @access  Private
 */
router.get('/me/progress', authenticateUser, UsersController.getProgress);


/**
 * @route   POST /api/users/study-time
 * @desc    Update user study time
 * @access  Private
 */
router.post('/study-time', authenticateUser, UsersController.updateStudyTime);

/**
 * @route   GET /api/users/analytics/activity
 * @desc    Get activity heatmap data
 * @access  Private
 */
router.get('/analytics/activity', authenticateUser, UsersController.getActivityHeatmap);

/**
 * @route   GET /api/users/analytics/radar
 * @desc    Get skill radar data
 * @access  Private
 */
router.get('/analytics/radar', authenticateUser, UsersController.getSkillRadar);

/**
 * @route   GET /api/users/analytics/weekly
 * @desc    Get weekly progress stats
 * @access  Private
 */
router.get('/analytics/weekly', authenticateUser, UsersController.getWeeklyProgress);

export default router;

