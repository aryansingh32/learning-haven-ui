import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TasksService } from '../services/tasks.service';
import logger from '../config/logger';

export class TasksController {
    /**
     * POST /api/tasks
     */
    static async createTask(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const task = await TasksService.createTask(userId, req.body);
            res.status(201).json(task);
        } catch (error) {
            logger.error('Create task error:', error);
            res.status(500).json({ error: 'Failed to create task' });
        }
    }

    /**
     * GET /api/tasks
     */
    static async listTasks(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const filters = {
                date: req.query.date as string | undefined,
                status: req.query.status as string | undefined,
                type: req.query.type as string | undefined,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 50,
            };
            const result = await TasksService.listTasks(userId, filters);
            res.json(result);
        } catch (error) {
            logger.error('List tasks error:', error);
            res.status(500).json({ error: 'Failed to list tasks' });
        }
    }

    /**
     * PUT /api/tasks/:id
     */
    static async updateTask(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const taskId = req.params.id as string;
            const task = await TasksService.updateTask(userId, taskId, req.body);
            res.json(task);
        } catch (error) {
            logger.error('Update task error:', error);
            res.status(500).json({ error: 'Failed to update task' });
        }
    }

    /**
     * DELETE /api/tasks/:id
     */
    static async deleteTask(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const taskId = req.params.id as string;
            const result = await TasksService.deleteTask(userId, taskId);
            res.json(result);
        } catch (error) {
            logger.error('Delete task error:', error);
            res.status(500).json({ error: 'Failed to delete task' });
        }
    }

    /**
     * GET /api/tasks/summary
     */
    static async getTaskSummary(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const summary = await TasksService.getTaskSummary(userId);
            res.json(summary);
        } catch (error) {
            logger.error('Task summary error:', error);
            res.status(500).json({ error: 'Failed to get task summary' });
        }
    }
}
