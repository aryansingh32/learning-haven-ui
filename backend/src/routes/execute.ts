/**
 * Code Execution Routes
 * Provides backend execution endpoints for languages that can't run in-browser.
 */

import { Router } from 'express';
import { ExecuteController } from '../controllers/execute.controller';

const router = Router();

// Java execution (requires JDK on server)
router.post('/java', ExecuteController.executeJava);

// Health check for available execution backends
router.get('/health', ExecuteController.health);

export default router;
