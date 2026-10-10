import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';

const router = Router();

/**
 * @route   GET /api/portfolio/:handle
 * @desc    A learner's published portfolio (opt-in; 404 when private or unknown)
 * @access  Public
 */
router.get('/:handle', AccountController.getPublicPortfolio);

export default router;
