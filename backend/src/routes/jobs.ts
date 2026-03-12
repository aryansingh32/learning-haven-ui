import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller';

const router = Router();

/**
 * @route   GET /api/jobs
 * @desc    Get paginated active jobs with optional type filter
 * @access  Public
 */
router.get('/', JobsController.getJobs);

/**
 * @route   GET /api/jobs/latest
 * @desc    Get top 3 latest active jobs
 * @access  Public
 */
router.get('/latest', JobsController.getLatestJobs);

export default router;
