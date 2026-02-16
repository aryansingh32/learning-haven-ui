import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PaymentsService } from '../services/payments.service';
import { verifyWebhookSignature } from '../config/razorpay';
import logger from '../config/logger';

export class PaymentsController {
    /**
     * POST /api/payments/create-order
     */
    static async createOrder(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { plan_id } = req.body;

            const order = await PaymentsService.createOrder(userId, plan_id);

            res.status(201).json(order);
        } catch (error: any) {
            logger.error('Create order error:', error);

            if (error.message === 'Invalid plan selected') {
                return res.status(400).json({ error: error.message });
            }
            if (error.message === 'You already have this plan active') {
                return res.status(409).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to create order' });
        }
    }

    /**
     * POST /api/payments/verify
     */
    static async verifyPayment(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

            const result = await PaymentsService.verifyPayment(
                userId,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            );

            res.json(result);
        } catch (error: any) {
            logger.error('Verify payment error:', error);

            if (error.message === 'Payment verification failed') {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to verify payment' });
        }
    }

    /**
     * POST /api/payments/webhook
     * Called by Razorpay servers — no auth needed, uses webhook signature
     */
    static async handleWebhook(req: Request, res: Response) {
        try {
            const signature = req.headers['x-razorpay-signature'] as string;

            if (!signature) {
                return res.status(400).json({ error: 'Missing signature' });
            }

            // Verify webhook signature
            const isValid = verifyWebhookSignature(
                JSON.stringify(req.body),
                signature
            );

            if (!isValid) {
                logger.warn('Invalid webhook signature');
                return res.status(400).json({ error: 'Invalid signature' });
            }

            const { event, payload } = req.body;
            await PaymentsService.handleWebhook(event, payload);

            // Always return 200 to Razorpay
            res.json({ status: 'ok' });
        } catch (error) {
            logger.error('Webhook handler error:', error);
            // Still return 200 to prevent retries for handled errors
            res.json({ status: 'ok' });
        }
    }

    /**
     * GET /api/payments/history
     */
    static async getPaymentHistory(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const history = await PaymentsService.getPaymentHistory(userId);

            res.json(history);
        } catch (error) {
            logger.error('Payment history error:', error);
            res.status(500).json({ error: 'Failed to fetch payment history' });
        }
    }
}
