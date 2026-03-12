import { Router } from 'express';
import { ResumeController } from '../controllers/resume.controller';
import { authenticateUser, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/resume/improve
 * @desc    Improve resume description using AI
 * @access  Private (Standard or Pro)
 */
router.post('/improve', authenticateUser, ResumeController.improveText);

export default router;
