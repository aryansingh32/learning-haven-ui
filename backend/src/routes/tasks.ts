import { Router } from 'express';
import { TasksController } from '../controllers/tasks.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// All task routes require authentication
router.use(authenticateUser);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post('/', TasksController.createTask);

/**
 * @route   GET /api/tasks
 * @desc    List tasks (query: date, status, type, page, limit)
 * @access  Private
 */
router.get('/', TasksController.listTasks);

/**
 * @route   GET /api/tasks/summary
 * @desc    Get today's task summary
 * @access  Private
 */
router.get('/summary', TasksController.getTaskSummary);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task (title, status, priority, etc.)
 * @access  Private
 */
router.put('/:id', TasksController.updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', TasksController.deleteTask);

export default router;
