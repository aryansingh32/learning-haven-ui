import { Router } from 'express';
import { CoursesController } from '../controllers/courses.controller';
import { authenticateUser } from '../../../middleware/auth';
import { ChaptersService } from '../services/chapters.service';
import { accessService } from '../../entitlements/access.service';

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
        return res.json({ chapters });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to fetch course chapters' });
    }
});

/**
 * @route   GET /api/courses/:idOrSlug
 * @desc    Get course detail with items
 * @access  Public
 */
router.get('/:idOrSlug', CoursesController.getCourse);

export default router;
