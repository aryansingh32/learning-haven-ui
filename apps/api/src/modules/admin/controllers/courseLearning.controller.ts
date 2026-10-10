import { Request, Response } from 'express';
import logger from '../../../config/logger';
import {
    CourseLearningAdminService, EXPORT_TYPES, parseLearningSettings, type ExportType,
} from '../services/courseLearningAdmin.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin: course prerequisites, drip release, and course export (routes ride requireAdmin in admin.ts). */
export class CourseLearningController {
    static async getSettings(req: Request, res: Response) {
        const id = String(req.params.id);
        if (!UUID.test(id)) return res.status(404).json({ error: 'Course not found' });
        try {
            const settings = await CourseLearningAdminService.getSettings(id);
            return settings ? res.json(settings) : res.status(404).json({ error: 'Course not found' });
        } catch (err) {
            logger.error('Get course learning settings failed', { id, error: (err as Error).message });
            return res.status(500).json({ error: 'Failed to load learning settings' });
        }
    }

    static async saveSettings(req: Request, res: Response) {
        const id = String(req.params.id);
        if (!UUID.test(id)) return res.status(404).json({ error: 'Course not found' });
        const input = parseLearningSettings(req.body, id);
        if (typeof input === 'string') return res.status(400).json({ error: input });
        try {
            const adminId = (req as unknown as { user: { id: string } }).user.id;
            const result = await CourseLearningAdminService.saveSettings(id, input, adminId);
            if (result === 'not_found') return res.status(404).json({ error: 'Course not found' });
            if (result === 'unknown_course') return res.status(400).json({ error: 'One of the prerequisite courses does not exist' });
            if (result === 'cycle') return res.status(400).json({ error: 'Those prerequisites would form a loop (a course would end up requiring itself)' });
            return res.json(result);
        } catch (err) {
            logger.error('Save course learning settings failed', { id, error: (err as Error).message });
            return res.status(500).json({ error: 'Failed to save learning settings' });
        }
    }

    /** GET /admin/courses/:id/export?type=chapters_meta|chapter_steps → CSV the content import reads back. */
    static async exportCourse(req: Request, res: Response) {
        const id = String(req.params.id);
        const type = String(req.query.type || 'chapters_meta') as ExportType;
        if (!UUID.test(id)) return res.status(404).json({ error: 'Course not found' });
        if (!EXPORT_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${EXPORT_TYPES.join(', ')}` });
        try {
            const out = await CourseLearningAdminService.exportCourse(id, type);
            if (!out) return res.status(404).json({ error: 'Course not found' });
            const fileName = `${out.slug.replace(/[^a-z0-9-]/gi, '_')}-${type}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            return res.send(out.csv);
        } catch (err) {
            logger.error('Course export failed', { id, error: (err as Error).message });
            return res.status(500).json({ error: 'Failed to export course' });
        }
    }
}
