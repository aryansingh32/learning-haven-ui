import { Router } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { writeRateLimit } from '../../../middleware/rateLimit';
import { autosaveAnswerSchema } from '../validators/testseries.validators';
import { TestSeriesController } from '../controllers/testseries.controller';

const router = Router();

/**
 * GET /api/test-series/catalog
 * Public browse: exam categories -> published series -> published tests.
 */
router.get('/catalog', authenticateUser, TestSeriesController.getCatalog);

/**
 * GET /api/test-series/tests/:testId
 * Test metadata for the pre-attempt instructions screen. Does not start
 * an attempt or start the timer.
 */
router.get('/tests/:testId', authenticateUser, TestSeriesController.getTestMeta);

/**
 * POST /api/test-series/tests/:testId/start
 * Starts (or resumes) a server-authoritative CBT attempt.
 */
router.post('/tests/:testId/start', authenticateUser, writeRateLimit, TestSeriesController.startAttempt);

/**
 * PATCH /api/test-series/attempts/:attemptId/questions/:questionId
 * Autosaves a single question's answer state. Rejected once the
 * attempt's server-set expiry has passed.
 */
router.patch(
  '/attempts/:attemptId/questions/:questionId',
  authenticateUser,
  writeRateLimit,
  validate(autosaveAnswerSchema),
  TestSeriesController.autosaveAnswer
);

/**
 * POST /api/test-series/attempts/:attemptId/submit
 * Finalizes and scores the attempt using only server-persisted answers.
 */
router.post('/attempts/:attemptId/submit', authenticateUser, writeRateLimit, TestSeriesController.submitAttempt);

/**
 * GET /api/test-series/attempts/:attemptId
 */
router.get('/attempts/:attemptId', authenticateUser, TestSeriesController.getAttempt);

export default router;
