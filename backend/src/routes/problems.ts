import { Router } from 'express';
import { ProblemsController } from '../controllers/problems.controller';
import { SubmissionsController } from '../controllers/submissions.controller';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getProblemsSchema, getProblemSchema, submitSolutionSchema } from '../utils/validators';

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
