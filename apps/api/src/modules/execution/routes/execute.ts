/**
 * Code Execution Routes
 * Provides backend execution endpoints for languages that can't run in-browser.
 */

import { Router } from 'express';
import { ExecuteController } from '../controllers/execute.controller';
import { authenticateUser } from '../../../middleware/auth';
import { submissionRateLimit } from '../../../middleware/rateLimit';

const router = Router();

// Java execution (requires JDK on server) — runs untrusted user code, must be authenticated + rate-limited.
router.post('/java', authenticateUser, submissionRateLimit, ExecuteController.executeJava);

// Health check for available execution backends
router.get('/health', ExecuteController.health);

export default router;
