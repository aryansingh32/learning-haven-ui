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
}
