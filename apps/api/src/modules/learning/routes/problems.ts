import { Router } from 'express';
import { ProblemsController } from '../controllers/problems.controller';
import { SubmissionsController } from '../controllers/submissions.controller';
import { JudgeController } from '../controllers/judge.controller';
import { submissionRateLimit } from '../../../middleware/rateLimit';
import { authenticateUser, optionalAuth } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { getProblemsSchema, getProblemSchema, submitSolutionSchema } from '../../../utils/validators';

const router = Router();

/**
 * @route   GET /api/problems
 * @desc    Get problems list with filters
 * @access  Public (but shows solved status if authenticated)
 */
router.get(
    '/',
    optionalAuth, // Optional auth to show solved status
    validate(getProblemsSchema),
    ProblemsController.getProblems
);

/**
 * @route   GET /api/problems/:slug
 * @desc    Get single problem details
 * @access  Public
 */
router.get(
    '/:slug',
    optionalAuth,
    validate(getProblemSchema),
    ProblemsController.getProblem
);

/**
 * @route   POST /api/problems/:id/submit
 * @desc    Submit solution for a problem
 * @access  Private
 */
router.post(
    '/:id/submit',
    authenticateUser,
    validate(submitSolutionSchema),
    SubmissionsController.submitSolution
);

/**
 * @route   POST /api/problems/:id/judge
 * @desc    Judge a solution on the server against every test; solve + XP only when all pass
 * @access  Private
 */
router.post('/:id/judge', authenticateUser, submissionRateLimit, JudgeController.judge);

/**
 * @route   POST /api/problems/:id/status
 * @desc    Mark a problem tried / for revision (solved only for problems without tests)
 * @access  Private
 */
router.post('/:id/status', authenticateUser, JudgeController.setStatus);

/**
 * @route   GET /api/problems/:id/hints
 * @desc    Get problem hints (premium)
 * @access  Private
 */
router.get(
    '/:id/hints',
    authenticateUser,
    ProblemsController.getHints
);

/**
 * @route   GET /api/problems/:id/solution
 * @desc    Get problem solution (premium)
 * @access  Private
 */
router.get(
    '/:id/solution',
    authenticateUser,
    ProblemsController.getSolution
);

export default router;
