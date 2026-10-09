import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { GamificationController, AchievementsController } from '../controllers/gamification.controller';
import { authenticateUser } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { updateProfileSchema } from '../../../utils/validators';

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
 * @route   PATCH /api/users/me/profile
 * @desc    Patch user profile (used for onboarding)
 * @access  Private
 */
router.patch(
    '/me/profile',
    authenticateUser,
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
 * @route   GET /api/users/me/insights
 * @desc    Dashboard: study time by day, goals, recent assessment results, activity feed
 * @access  Private
 */
router.get('/me/insights', authenticateUser, UsersController.getInsights);

/**
 * @route   PUT /api/users/me/goals
 * @desc    Set daily study minutes, weekly problems and the learning goal
 * @access  Private
 */
router.put('/me/goals', authenticateUser, UsersController.updateGoals);

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

/**
 * @route   GET /api/users/me/mission
 * @desc    Get current mission based on real progress
 * @access  Private
 */
router.get('/me/mission', authenticateUser, GamificationController.getMission);

/**
 * @route   GET /api/users/me/daily-quests
 * @desc    Get or create today's daily quests
 * @access  Private
 */
router.get('/me/daily-quests', authenticateUser, GamificationController.getDailyQuests);

/**
 * @route   POST /api/users/me/daily-quests/complete
 * @desc    Mark a daily quest item complete
 * @access  Private
 */
router.post('/me/daily-quests/complete', authenticateUser, GamificationController.completeDailyQuest);

/**
 * @route   GET /api/users/me/identity
 * @desc    Get identity title, badges, streak info
 * @access  Private
 */
router.get('/me/identity', authenticateUser, GamificationController.getIdentity);

/**
 * @route   GET /api/users/me/mentor-context
 * @desc    Get contextual AI mentor state from real activity
 * @access  Private
 */
router.get('/me/mentor-context', authenticateUser, GamificationController.getMentorContext);

/**
 * @route   GET /api/users/me/achievements
 * @desc    Weekly missions (India week), coding streak, milestones (awarded here, once), badge collections
 * @access  Private
 */
router.get('/me/achievements', authenticateUser, AchievementsController.get);

/**
 * @route   POST /api/users/me/missions/:key/claim
 * @desc    Claim a finished weekly mission's XP (once; held to the daily XP limit)
 * @access  Private
 */
router.post('/me/missions/:key/claim', authenticateUser, AchievementsController.claimMission);

/**
 * @route   GET /api/users/leaderboard?period=all|week&limit=50
 * @desc    Learner leaderboard: privacy-safe names, opted-out learners left out, plus the caller's own rank
 * @access  Private
 */
router.get('/leaderboard', authenticateUser, AchievementsController.leaderboard);

/**
 * @route   PUT /api/users/me/leaderboard-visibility   { hidden: boolean }
 * @desc    Opt out of (or back into) the leaderboards
 * @access  Private
 */
router.put('/me/leaderboard-visibility', authenticateUser, AchievementsController.setLeaderboardVisibility);

export default router;

