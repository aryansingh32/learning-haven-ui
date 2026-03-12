import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import logger from '../config/logger';

const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'dsaos_webhook_secret';

export class WhatsAppController {
    /**
     * GET /api/whatsapp/webhook
     * Required by Meta to verify the webhook during setup.
     */
    static verifyWebhook(req: Request, res: Response) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
            logger.info('WhatsApp webhook verified successfully.');
            return res.status(200).send(challenge);
        }
        return res.sendStatus(403);
    }

    /**
     * POST /api/whatsapp/webhook
     * Receives messages from WhatsApp Cloud API.
     */
    static async handleWebhook(req: Request, res: Response) {
        // Always respond 200 immediately to avoid retries
        res.sendStatus(200);

        try {
            const body = req.body;
            if (body.object !== 'whatsapp_business_account') return;

            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            // Incoming text message
            const messages = value?.messages;
            if (!messages || !messages.length) return;

            const msg = messages[0];
            if (msg.type !== 'text') return;

            const from = msg.from; // WhatsApp phone number
            const text = msg.text?.body || '';

            logger.info('Incoming WhatsApp message', { from, text: text.substring(0, 50) });

            const reply = await WhatsAppService.handleIncomingMessage(from, text);
            await WhatsAppService.sendMessage(from, reply);
        } catch (err) {
            logger.error('WhatsApp webhook handler error:', err);
        }
    }
}
