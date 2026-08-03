import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();

/**
 * @route   POST /api/whatsapp/webhook
 * @desc    Handle incoming messages from WhatsApp API
 * @access  Public (verified by webhook token/signature)
 */
router.post('/webhook', WhatsAppController.handleWebhook);

/**
 * @route   GET /api/whatsapp/webhook
 * @desc    Verify webhook registration (Meta API requirement)
 * @access  Public
 */
router.get('/webhook', WhatsAppController.verifyWebhook);

export default router;
