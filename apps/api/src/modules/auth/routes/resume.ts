import { Router } from 'express';
import { ResumeController } from '../controllers/resume.controller';
import { authenticateUser } from '../../../middleware/auth';
import { writeRateLimit } from '../../../middleware/rateLimit';

const router = Router();

/**
 * @route   GET /api/user-resume
 * @desc    Load user's saved resume data
 * @access  Private
 */
router.get('/', authenticateUser, ResumeController.load);

/**
 * @route   POST /api/user-resume
 * @desc    Save user's resume data
 * @access  Private
 */
router.post('/', authenticateUser, writeRateLimit, ResumeController.save);

export default router;
