import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { PaymentsService } from '../services/payments.service';
import { verifyWebhookSignature } from '../../../config/razorpay';
import logger from '../../../config/logger';
import {
  ok,
  created,
  badRequest,
  unauthorized,
  conflict,
  serverError,
} from '../../../utils/api-response';

export class PaymentsController {
    /**
     * POST /api/payments/create-order
     */
    static async createOrder(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { plan_id, coupon_code } = req.body;

            const order = await PaymentsService.createOrder(userId, plan_id, coupon_code);

            return created(res, order);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create order';
            logger.error('Create order error:', error);

            if (message === 'Invalid plan selected') {
                return badRequest(res, message);
            }
            if (message === 'You already have this plan active') {
                return conflict(res, message);
            }

            return serverError(res);
        }
    }

    /**
     * POST /api/payments/validate-coupon
     */
    static async validateCoupon(req: Request, res: Response) {
        try {
            const { code, plan_id } = req.body;
            
            if (!code) {
                return badRequest(res, 'Coupon code is required');
            }

            const result = await PaymentsService.validateCoupon(code, plan_id);
            return ok(res, result);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to validate coupon';
            logger.error('Validate coupon error:', error);
            
            if (message.includes('Coupon') || message.includes('Minimum') || message.includes('Invalid')) {
                return badRequest(res, message);
            }

            return serverError(res);
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

            return ok(res, result);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to verify payment';
            logger.error('Verify payment error:', error);

            if (message === 'Payment verification failed') {
                return badRequest(res, message);
            }

            return serverError(res);
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
                return badRequest(res, 'Missing signature');
            }

            // Verify webhook signature
            const isValid = verifyWebhookSignature(
                JSON.stringify(req.body),
                signature
            );

            if (!isValid) {
                logger.warn('Invalid webhook signature');
                return badRequest(res, 'Invalid signature');
            }

            const { event, payload } = req.body;
            await PaymentsService.handleWebhook(event, payload);

            // Always return 200 to Razorpay
            return ok(res, { status: 'ok' });
        } catch (error) {
            logger.error('Webhook handler error:', error);
            // Still return 200 to prevent retries for handled errors
            return ok(res, { status: 'ok' });
        }
    }

    /**
     * GET /api/payments/history
     */
    static async getPaymentHistory(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const history = await PaymentsService.getPaymentHistory(userId);

            return ok(res, history);
        } catch (error) {
            logger.error('Payment history error:', error);
            return serverError(res);
        }
    }
}
