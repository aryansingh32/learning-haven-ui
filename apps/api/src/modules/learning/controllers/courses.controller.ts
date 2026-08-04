import { Request, Response } from 'express';
import { CoursesService } from '../services/courses.service';
import logger from '../../../config/logger';

export class CoursesController {
    /**
     * GET /api/courses
     */
    static async listCourses(req: Request, res: Response) {
        try {
            const courses = await CoursesService.listCourses();
            res.json(courses);
        } catch (error) {
            logger.error('List courses error:', error);
            res.status(500).json({ error: 'Failed to list courses' });
        }
    }

    /**
     * GET /api/courses/:idOrSlug
     */
    static async getCourse(req: Request, res: Response) {
        try {
            const course = await CoursesService.getCourse(req.params.idOrSlug as string);
            res.json(course);
        } catch (error) {
            logger.error('Get course error:', error);
            res.status(500).json({ error: 'Failed to get course' });
        }
    }

    /**
     * GET /api/courses/enrollments/mine
     */
    static async getMyEnrollments(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });
            
            const enrollments = await CoursesService.getMyEnrollments(userId);
            res.json({ enrollments });
        } catch (error) {
            logger.error('Get my enrollments error:', error);
            res.status(500).json({ error: 'Failed to fetch enrollments' });
        }
    }

    /**
     * POST /api/courses/:id/enroll
     */
    static async enroll(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const courseId = req.params.id as string;
            const enrollment = await CoursesService.enroll(userId, courseId);
            res.json({ enrollment });
        } catch (error) {
            logger.error('Enroll error:', error);
            res.status(500).json({ error: 'Failed to enroll in course' });
        }
    }
}
