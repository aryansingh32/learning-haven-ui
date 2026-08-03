import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();

/**
 * @route   GET /api/settings/public
 * @desc    Get public system settings (onboarding, quick actions, etc.)
 * @access  Public
 */
router.get('/public', SettingsController.getPublicSettings);

export default router;
