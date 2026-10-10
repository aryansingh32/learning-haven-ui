import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { PaymentsV2Service } from '../services/payments.v2.service';
import { verifyWebhookSignature } from '../../../config/razorpay';
import logger from '../../../config/logger';
import { pool } from '../../../config/database';
import { ok, created, badRequest, conflict, serverError } from '../../../utils/api-response';

export class PaymentsV2Controller {
  /**
   * GET /api/v2/payments/plans
   */
  static async getPlans(req: Request, res: Response) {
    try {
      const result = await pool.query(
        `SELECT p.*, 
                COALESCE(
                  JSON_AGG(
                    JSON_BUILD_OBJECT(
                      'id', pe.id,
                      'feature_key', pe.feature_key,
                      'label', pe.label,
                      'entitlement_type', pe.entitlement_type,
                      'bool_value', pe.bool_value,
                      'numeric_value', pe.numeric_value,
                      'resource_type', pe.resource_type,
                      'resource_id', pe.resource_id
                    )
                  ) FILTER (WHERE pe.id IS NOT NULL),
                  '[]'::json
                ) AS entitlements
         FROM public.plans p
         LEFT JOIN public.plan_entitlements pe ON pe.plan_id = p.id
         WHERE p.is_active = true
         GROUP BY p.id
         ORDER BY p.sort_order ASC`
      );
      return ok(res, result.rows);
    } catch (error) {
      logger.error('Get plans error:', error);
      return serverError(res);
    }
  }

  /**
   * GET /api/v2/payments/subscription
   */
  static async getCurrentSubscription(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await pool.query(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug 
         FROM public.subscriptions s 
         JOIN public.plans p ON p.id = s.plan_id 
         WHERE s.user_id = $1 AND s.status = 'active'
         ORDER BY s.created_at DESC LIMIT 1`,
        [userId]
      );
      return ok(res, result.rows[0] || null);
    } catch (error) {
      logger.error('Get subscription error:', error);
      return serverError(res);
    }
  }

  /**
   * POST /api/v2/payments/create-order
   */
  static async createOrder(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { plan_id, billing_cycle, coupon_code, resource_type, resource_id } = req.body;

      const order = await PaymentsV2Service.createOrder(
        userId,
        plan_id,
        billing_cycle,
        coupon_code,
        resource_type && resource_id ? { type: resource_type, id: resource_id } : undefined,
      );
      return created(res, order);
    } catch (error: any) {
      logger.error('Create order error:', error);
      return badRequest(res, error.message || 'Failed to create order');
    }
  }

  /**
   * POST /api/v2/payments/verify
   */
  static async verifyPayment(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const result = await PaymentsV2Service.verifyAndActivate(
        userId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );
      return ok(res, result);
    } catch (error: any) {
      logger.error('Verify payment error:', error);
      return badRequest(res, error.message || 'Payment verification failed');
    }
  }

  /**
   * POST /api/v2/payments/webhook
   */
  static async handleWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) return badRequest(res, 'Missing signature');

      const isValid = verifyWebhookSignature(JSON.stringify(req.body), signature);
      if (!isValid) return badRequest(res, 'Invalid signature');

      const { event, payload } = req.body;
      await PaymentsV2Service.handleWebhook(event, payload);

      return ok(res, { status: 'ok' });
    } catch (error) {
      logger.error('Webhook error:', error);
      return ok(res, { status: 'ok' }); // Always 200 to Razorpay
    }
  }

  /**
   * POST /api/v2/payments/validate-coupon
   */
  static async validateCoupon(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { code, plan_slug, billing_cycle } = req.body;

      let basePrice: number | undefined;
      if (plan_slug && billing_cycle) {
        const planRes = await pool.query(
          `SELECT price_monthly, price_annual, price_lifetime, price_one_time FROM public.plans WHERE slug = $1 AND is_active = true`,
          [plan_slug]
        );
        if (planRes.rows.length > 0) {
          const plan = planRes.rows[0];
          switch (billing_cycle) {
            case 'monthly': basePrice = plan.price_monthly; break;
            case 'annual': basePrice = plan.price_annual; break;
            case 'lifetime': basePrice = plan.price_lifetime; break;
            case 'one_time': basePrice = plan.price_one_time; break;
          }
        }
      }

      const result = await PaymentsV2Service.validateCoupon(code, plan_slug || '', userId, basePrice);
      return ok(res, result);
    } catch (error: any) {
      logger.error('Validate coupon error:', error);
      return serverError(res);
    }
  }

  /**
   * POST /api/v2/payments/cancel-subscription
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { reason } = req.body;
      const result = await PaymentsV2Service.cancelSubscription(userId, reason);
      return ok(res, result);
    } catch (error: any) {
      logger.error('Cancel sub error:', error);
      return badRequest(res, error.message);
    }
  }

  /**
   * GET /api/v2/payments/history
   */
  static async getPaymentHistory(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const history = await PaymentsV2Service.getPaymentHistory(userId);
      return ok(res, history);
    } catch (error) {
      logger.error('Payment history error:', error);
      return serverError(res);
    }
  }
}
