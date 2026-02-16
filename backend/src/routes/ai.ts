import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticateUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { aiChatSchema } from '../utils/validators';

const router = Router();

/**
 * @route   POST /api/ai/chat
 * @desc    Send message to AI coach
 * @access  Private
 */
router.post(
    '/chat',
    authenticateUser,
    validate(aiChatSchema),
    AIController.chat
);

/**
 * @route   GET /api/ai/history
 * @desc    Get chat history
 * @access  Private
 */
router.get('/history', authenticateUser, AIController.getHistory);

/**
 * @route   DELETE /api/ai/history
 * @desc    Clear chat history
 * @access  Private
 */
router.delete('/history', authenticateUser, AIController.clearHistory);

/**
 * @route   GET /api/ai/usage
 * @desc    Get AI usage/quota info
 * @access  Private
 */
router.get('/usage', authenticateUser, AIController.getUsage);

export default router;
