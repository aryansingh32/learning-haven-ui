import { Router } from 'express';
import { CoursesController } from '../controllers/courses.controller';
import { authenticateUser, optionalAuth } from '../../../middleware/auth';
import { ChaptersService } from '../services/chapters.service';
import { accessService } from '../../entitlements/access.service';
import { LearningGateService } from '../services/learningGate.service';

const router = Router();

/**
 * @route   GET /api/courses
 * @desc    List all published courses
 * @access  Public
 */
router.get('/', CoursesController.listCourses);

/**
 * @route   GET /api/courses/enrollments/mine
 * @desc    Get user's enrolled courses
 * @access  Private
 */
router.get('/enrollments/mine', authenticateUser, CoursesController.getMyEnrollments);

/**
 * @route   POST /api/courses/:id/enroll
 * @desc    Enroll in a course
 * @access  Private
 */
router.post('/:id/enroll', authenticateUser, CoursesController.enroll);

/**
 * @route   GET /api/courses/:courseId/chapters
 * @desc    Get course chapters with user progress status
 * @access  Private
 */
router.get('/:courseId/chapters', authenticateUser, async (req: any, res: any) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // The syllabus should be visible to everyone. 
        // Individual chapters are paywalled within getCourseChaptersForUser.

        const chapters = await ChaptersService.getCourseChaptersForUser(userId, courseId);
        // What this course needs first, and whether it's blocked for this learner.
        const start = await LearningGateService.checkCourseStart(userId, courseId);
        const drip = await LearningGateService.dripSettings(userId, courseId);
        return res.json({
            chapters,
            prerequisites: start.prerequisites,
            prerequisites_blocked: start.blocked,
            prerequisites_exemption: start.exemption,
            prerequisites_message: start.message,
            drip: { interval_days: drip.intervalDays, started_at: drip.startedAt },
        });
    } catch (error: any) {
        if (error?.message === 'Course not found') return res.status(404).json({ error: 'Course not found' });
        return res.status(500).json({ error: error.message || 'Failed to fetch course chapters' });
    }
});

/**
 * @route   GET /api/courses/:idOrSlug
 * @desc    Get course detail with items
 * @access  Public
 */
router.get('/:idOrSlug', optionalAuth, CoursesController.getCourse);

export default router;
