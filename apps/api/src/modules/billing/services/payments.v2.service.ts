import { pool } from '../../../config/database';
import { calculateGST, getSubscriptionEndDate } from '../../../utils/plans';
import razorpay, { verifyPaymentSignature, verifyWebhookSignature } from '../../../config/razorpay';
import redis from '../../../config/redis';
import { env } from '../../../config/env';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';
import { Queue } from 'bullmq';

const monetizationQueue = new Queue('monetization', {
  connection: redis,
});

export class PaymentsV2Service {
  private static featureForResource(resourceType?: string | null) {
    switch (resourceType) {
      case 'course':
        return 'course_access';
      case 'career_path':
        return 'career_path_access';
      case 'project':
        return 'project_access';
      case 'apprenticeship_program':
        return 'apprenticeship_access';
      default:
        return null;
    }
  }

  /**
   * Create a new Razorpay order.
   */
  static async createOrder(
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'annual' | 'lifetime' | 'one_time',
    couponCode?: string,
    resource?: { type?: string; id?: string },
  ) {
    // 1. Fetch plan
    const planResult = await pool.query(
      `SELECT * FROM public.plans WHERE id = $1 AND is_active = true`,
      [planId],
    );
    if (planResult.rows.length === 0) {
      throw new Error('Invalid or inactive plan');
    }
    const plan = planResult.rows[0];

    // 2. Determine base price
    let basePrice = 0;
    switch (billingCycle) {
      case 'monthly': basePrice = plan.price_monthly; break;
      case 'annual': basePrice = plan.price_annual; break;
      case 'lifetime': basePrice = plan.price_lifetime; break;
      case 'one_time': basePrice = plan.price_one_time; break;
    }
    if (basePrice == null) {
      throw new Error(`Billing cycle ${billingCycle} is not available for this plan`);
    }

    // 3. Apply coupon
    let discountAmount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const cv = await this.validateCoupon(couponCode, plan.slug, userId, basePrice);
      if (!cv.valid) throw new Error(cv.reason);
      discountAmount = cv.discountAmount;
      couponId = cv.coupon.id;
    }

    const discountedPrice = Math.max(0, basePrice - discountAmount);
    
    // 4. Calculate GST
    // Note: Our basePrice already INCLUDES GST. 
    // calculateGST expects the MRP (inclusive of tax).
    const gstInfo = calculateGST(discountedPrice);
    const finalAmountInPaise = gstInfo.total;

    if (finalAmountInPaise < 100 && finalAmountInPaise > 0) {
       throw new Error('Final amount cannot be less than ₹1');
    }

    // 5. Create Razorpay order (only if amount > 0)
    let razorpayOrderId = `free_order_${Date.now()}_${userId.slice(0, 8)}`;
    if (finalAmountInPaise > 0) {
      const order = await razorpay.orders.create({
        amount: finalAmountInPaise,
        currency: 'INR',
        receipt: `order_${userId}_${Date.now()}`,
        notes: { user_id: userId, plan_id: planId, billing_cycle: billingCycle },
      });
      razorpayOrderId = order.id;
    }

    // 6. Insert payment record
    const metadata = {
      purchase_kind: resource?.type && resource?.id ? 'resource' : 'plan',
      resource_type: resource?.type || null,
      resource_id: resource?.id || null,
    };

    const paymentResult = await pool.query(
      `INSERT INTO public.payments (
         user_id, plan_id, amount, discount_amount, tax_amount, final_amount,
         status, razorpay_order_id, coupon_id, coupon_code, billing_cycle, description, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        userId, planId, basePrice, discountAmount, gstInfo.gst_amount, finalAmountInPaise,
        'created', razorpayOrderId, couponId, couponCode, billingCycle,
        `${plan.name} (${billingCycle})`,
        metadata,
      ],
    );

    return {
      orderId: paymentResult.rows[0].id,
      razorpayOrderId,
      amount: basePrice,
      discountAmount,
      taxAmount: gstInfo.gst_amount,
      finalAmount: finalAmountInPaise,
      currency: 'INR',
      plan: { name: plan.name, slug: plan.slug, features: plan.features },
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Create a Razorpay order for a single course, priced from the course record
   * rather than from a subscription plan (Coursera-style one-time purchase).
   *
   * Grants permanent access on verification — see `verifyAndActivate`, which
   * leaves `expires_at` NULL when a purchase has no plan behind it.
   */
  static async createCourseOrder(userId: string, courseId: string, couponCode?: string) {
    const courseRes = await pool.query(
      `SELECT id, title, slug, price_inr, original_price_inr, is_free, is_published
         FROM public.courses
        WHERE (id::text = $1 OR slug = $1)
        LIMIT 1`,
      [courseId],
    );
    if (courseRes.rows.length === 0) {
      throw new Error('Course not found');
    }
    const course = courseRes.rows[0];

    if (!course.is_published) {
      throw new Error('This course is not available for purchase');
    }
    if (course.is_free) {
      throw new Error('This course is free — no purchase is required');
    }
    if (course.price_inr == null || course.price_inr <= 0) {
      throw new Error('This course is not individually purchasable');
    }

    // Already owned? Don't let the learner pay twice.
    const owned = await pool.query(
      `SELECT 1 FROM public.user_entitlements
        WHERE user_id = $1
          AND entitlement_type::text = 'resource_access'
          AND resource_type = 'course'
          AND resource_id = $2
          AND starts_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1`,
      [userId, course.id],
    );
    if (owned.rows.length > 0) {
      throw new Error('You already have access to this course');
    }

    const basePrice: number = course.price_inr;

    let discountAmount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      // Course coupons are validated against the catalog-wide scope.
      const cv = await this.validateCoupon(couponCode, 'course', userId, basePrice);
      if (!cv.valid) throw new Error(cv.reason);
      discountAmount = cv.discountAmount;
      couponId = cv.coupon.id;
    }

    const discountedPrice = Math.max(0, basePrice - discountAmount);
    const gstInfo = calculateGST(discountedPrice);
    const finalAmountInPaise = gstInfo.total;

    if (finalAmountInPaise < 100 && finalAmountInPaise > 0) {
      throw new Error('Final amount cannot be less than ₹1');
    }

    let razorpayOrderId = `free_order_${Date.now()}_${userId.slice(0, 8)}`;
    if (finalAmountInPaise > 0) {
      const order = await razorpay.orders.create({
        amount: finalAmountInPaise,
        currency: 'INR',
        receipt: `course_${userId.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: userId, course_id: course.id, purchase_kind: 'course' },
      });
      razorpayOrderId = order.id;
    }

    const metadata = {
      purchase_kind: 'resource',
      resource_type: 'course',
      resource_id: course.id,
      course_slug: course.slug,
    };

    const paymentResult = await pool.query(
      `INSERT INTO public.payments (
         user_id, plan_id, amount, discount_amount, tax_amount, final_amount,
         status, razorpay_order_id, coupon_id, coupon_code, billing_cycle, description, metadata
       ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        userId, basePrice, discountAmount, gstInfo.gst_amount, finalAmountInPaise,
        'created', razorpayOrderId, couponId, couponCode, 'one_time',
        course.title,
        metadata,
      ],
    );

    return {
      orderId: paymentResult.rows[0].id,
      razorpayOrderId,
      amount: basePrice,
      discountAmount,
      taxAmount: gstInfo.gst_amount,
      finalAmount: finalAmountInPaise,
      currency: 'INR',
      course: { id: course.id, title: course.title, slug: course.slug },
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Verify Razorpay payment and activate subscription.
   */
  static async verifyAndActivate(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    // 1. Verify signature (skip if free order bypass)
    if (!razorpayOrderId.startsWith('free_order_')) {
      const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!isValid) throw new Error('Payment verification failed');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Fetch payment
      const paymentRes = await client.query(
        `SELECT * FROM public.payments WHERE razorpay_order_id = $1 FOR UPDATE`,
        [razorpayOrderId]
      );
      if (paymentRes.rows.length === 0) throw new Error('Payment not found');
      const payment = paymentRes.rows[0];

      if (payment.status === 'captured') {
        await client.query('COMMIT');
        return { success: true, message: 'Payment already processed' }; // Idempotent
      }

      // 3. Fetch plan. A standalone resource purchase (e.g. a single course)
      //    has no plan_id, so `plan` may legitimately be undefined here.
      const planRes = payment.plan_id
        ? await client.query(`SELECT slug, name FROM public.plans WHERE id = $1`, [payment.plan_id])
        : { rows: [] as Array<{ slug: string; name: string }> };
      const plan = planRes.rows[0] as { slug: string; name: string } | undefined;
      const resourceType = payment.metadata?.resource_type;
      const resourceId = payment.metadata?.resource_id;
      const resourceFeature = this.featureForResource(resourceType);
      const isResourcePurchase = Boolean(resourceFeature && resourceId);

      if (!plan && !isResourcePurchase) {
        throw new Error('Payment references neither a plan nor a purchasable resource');
      }

      // Human-readable label for the granted entitlement and the receipt email.
      const purchaseLabel =
        plan?.name || payment.description || `${resourceType || 'Resource'} access`;

      // 4. Update payment status
      await client.query(
        `UPDATE public.payments SET status = 'captured', razorpay_payment_id = $1, razorpay_signature = $2, updated_at = NOW() WHERE id = $3`,
        [razorpayPaymentId, razorpaySignature, payment.id]
      );

      // 5. Work out access duration.
      const now = new Date();
      const periodEnd = getSubscriptionEndDate(payment.billing_cycle, now);
      let subscriptionId: string | null = null;

      if (!isResourcePurchase) {
        // 6. Plan purchase: replace active subscription.
        await client.query(
          `UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );

        const subRes = await client.query(
          `INSERT INTO public.subscriptions (
             user_id, plan_id, status, billing_cycle, amount_paid, current_period_start, current_period_end
           ) VALUES ($1, $2, 'active', $3, $4, $5, $6) RETURNING id`,
          [userId, payment.plan_id, payment.billing_cycle, payment.final_amount, now, periodEnd]
        );
        subscriptionId = subRes.rows[0].id;

        await client.query(`UPDATE public.payments SET subscription_id = $1 WHERE id = $2`, [subscriptionId, payment.id]);

        await client.query(
          `UPDATE public.users SET current_plan = $1, active_subscription_id = $2 WHERE id = $3`,
          [plan!.slug, subscriptionId, userId]
        );
      }

      if (resourceFeature && resourceId) {
        await client.query(
          `INSERT INTO public.user_entitlements (
             user_id, feature_key, entitlement_type, bool_value, resource_type, resource_id,
             label, source_payment_id, source_subscription_id, expires_at, metadata
           ) VALUES ($1, $2, 'resource_access', true, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, feature_key, resource_type, resource_id)
           DO UPDATE SET
             bool_value = true,
             source_payment_id = EXCLUDED.source_payment_id,
             source_subscription_id = EXCLUDED.source_subscription_id,
             expires_at = EXCLUDED.expires_at,
             metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
          [
            userId,
            resourceFeature,
            resourceType,
            resourceId,
            `${purchaseLabel} access`,
            payment.id,
            subscriptionId,
            // A standalone one-time purchase (no plan behind it) grants
            // permanent access; access bought as part of a subscription lapses
            // with that subscription.
            plan ? periodEnd : null,
            { plan_slug: plan?.slug ?? null, billing_cycle: payment.billing_cycle },
          ]
        );
      }

      // 8. Record coupon usage
      if (payment.coupon_id) {
        await client.query(
          `INSERT INTO public.coupon_usages (coupon_id, user_id, payment_id, discount_applied) VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [payment.coupon_id, userId, payment.id, payment.discount_amount]
        );
        await client.query(
          `UPDATE public.coupons SET used_count = used_count + 1 WHERE id = $1`,
          [payment.coupon_id]
        );
      }

      await client.query('COMMIT');

      // 9. Post-commit side effects
      await CacheService.delPattern(`entitlements:${userId}`);
      await CacheService.delPattern(`content_entitlements:${userId}`);
      await CacheService.del(`user_plan:${userId}`);
      await CacheService.delPattern(`plan_entitlements:*`);

      // Enqueue jobs
      await monetizationQueue.add('referral.check-and-activate', { userId, paymentId: payment.id });
      await monetizationQueue.add('payment.welcome-email', { userId, planName: purchaseLabel });

      return {
        success: true,
        subscriptionId,
        plan: plan ? { name: plan.name, slug: plan.slug } : null,
        resource: isResourcePurchase ? { type: resourceType, id: resourceId } : null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle Razorpay webhook.
   */
  static async handleWebhook(event: string, payload: any) {
    const paymentEntity = payload?.payment?.entity;
    if (!paymentEntity) return;

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    if (event === 'payment.captured' || event === 'payment.authorized') {
      // BUG-005 fix: Actually activate the subscription if payment is still 'created'.
      // Razorpay has already verified the webhook signature in the controller,
      // so we trust this event and activate without a separate signature check.
      try {
        const paymentRes = await pool.query(
          `SELECT id, user_id, plan_id, billing_cycle, final_amount, discount_amount, coupon_id, status
           FROM public.payments WHERE razorpay_order_id = $1`,
          [orderId]
        );
        if (paymentRes.rows.length === 0) {
          logger.warn(`Webhook payment.captured: no payment record for order ${orderId}`);
          return;
        }

        const payment = paymentRes.rows[0];

        if (payment.status === 'captured') {
          // Already handled by frontend verify flow — nothing to do
          logger.info(`Webhook payment.captured: already captured for order ${orderId}, skipping`);
          return;
        }

        // Payment is still 'created' (frontend failed to call verify) — activate now
        logger.info(`Webhook activating subscription for order ${orderId}, payment ${paymentId}`);

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Mark payment as captured
          await client.query(
            `UPDATE public.payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW() WHERE id = $2`,
            [paymentId, payment.id]
          );

          // Increment coupon usage if applicable
          if (payment.coupon_id) {
            await client.query(
              `UPDATE public.coupons SET used_count = used_count + 1 WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses)`,
              [payment.coupon_id]
            );
          }

          // Cancel existing active subscriptions
          await client.query(
            `UPDATE public.subscriptions SET status = 'cancelled', cancel_reason = 'upgrade', updated_at = NOW() WHERE user_id = $1 AND status = 'active'`,
            [payment.user_id]
          );

          // Determine subscription end date
          const now = new Date();
          const isYearly = payment.billing_cycle === 'annual' || payment.billing_cycle === 'yearly';
          const isLifetime = payment.billing_cycle === 'lifetime';
          const endDate = new Date(now);
          if (isLifetime) {
            endDate.setFullYear(endDate.getFullYear() + 100);
          } else if (isYearly) {
            endDate.setFullYear(endDate.getFullYear() + 1);
          } else {
            endDate.setMonth(endDate.getMonth() + 1);
          }

          // Create new subscription
          const subRes = await client.query(
            `INSERT INTO public.subscriptions (user_id, plan_id, billing_cycle, status, amount_paid, current_period_start, current_period_end)
             VALUES ($1, $2, $3, 'active', $4, $5, $6)
             RETURNING id`,
            [payment.user_id, payment.plan_id, payment.billing_cycle, payment.final_amount, now.toISOString(), endDate.toISOString()]
          );

          // Update user plan
          await client.query(
            `UPDATE public.users SET current_plan = (SELECT slug FROM public.plans WHERE id = $1), active_subscription_id = $2, updated_at = NOW() WHERE id = $3`,
            [payment.plan_id, subRes.rows[0].id, payment.user_id]
          );

          await client.query('COMMIT');

          // Invalidate entitlement caches
          await CacheService.delPattern(`entitlements:${payment.user_id}`);
          await CacheService.delPattern(`content_entitlements:${payment.user_id}`);
          await CacheService.del(`user_plan:${payment.user_id}`);

          logger.info(`Webhook successfully activated subscription for user ${payment.user_id} via webhook fallback`);
        } catch (e) {
          await client.query('ROLLBACK');
          logger.error('Webhook subscription activation error:', e);
        } finally {
          client.release();
        }
      } catch (e) {
        logger.error('Webhook payment.captured error:', e);
      }
    } else if (event === 'payment.failed') {
      await pool.query(`UPDATE public.payments SET status = 'failed' WHERE razorpay_order_id = $1`, [orderId]);
    } else if (event === 'refund.created') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const paymentRes = await client.query(`SELECT id, user_id FROM public.payments WHERE razorpay_payment_id = $1`, [paymentId]);
        if (paymentRes.rows.length > 0) {
          const p = paymentRes.rows[0];
          await client.query(`UPDATE public.payments SET status = 'refunded' WHERE id = $1`, [p.id]);
          await client.query(`UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id IN (SELECT subscription_id FROM public.payments WHERE id = $1)`, [p.id]);
          await client.query(`UPDATE public.users SET current_plan = 'free', active_subscription_id = NULL WHERE id = $1`, [p.user_id]);
          await CacheService.delPattern(`entitlements:${p.user_id}`);
          await CacheService.delPattern(`content_entitlements:${p.user_id}`);
          await CacheService.del(`user_plan:${p.user_id}`);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        logger.error('Webhook refund error:', e);
      } finally {
        client.release();
      }
    }
  }

  /**
   * Validate a discount coupon.
   */
  static async validateCoupon(code: string, planSlug: string, userId: string, basePrice?: number): Promise<any> {
    const result = await pool.query(`SELECT * FROM public.coupons WHERE code = $1 AND is_active = true`, [code]);
    if (result.rows.length === 0) return { valid: false, reason: 'Invalid or inactive coupon' };
    const coupon = result.rows[0];

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, reason: 'Coupon expired' };
    }
    if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
      return { valid: false, reason: 'Coupon not yet active' };
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }
    if (coupon.applicable_plan_slugs?.length > 0 && !coupon.applicable_plan_slugs.includes(planSlug)) {
      return { valid: false, reason: 'Coupon not applicable for this plan' };
    }

    if (coupon.one_use_per_user) {
      const usageRes = await pool.query(`SELECT 1 FROM public.coupon_usages WHERE coupon_id = $1 AND user_id = $2`, [coupon.id, userId]);
      if (usageRes.rows.length > 0) return { valid: false, reason: 'You have already used this coupon' };
    }

    let discountAmount = 0;
    if (basePrice !== undefined) {
      if (coupon.type === 'percentage') {
        discountAmount = Math.floor((basePrice * coupon.value) / 100);
        if (coupon.max_discount && discountAmount > coupon.max_discount) {
          discountAmount = coupon.max_discount;
        }
      } else if (coupon.type === 'fixed_amount') {
        discountAmount = coupon.value;
      }
      discountAmount = Math.min(basePrice, discountAmount);
    }

    return { valid: true, coupon, discountAmount };
  }

  /**
   * Cancel subscription at period end.
   */
  static async cancelSubscription(userId: string, reason?: string) {
    const result = await pool.query(
      `UPDATE public.subscriptions SET cancel_at_period_end = true, cancel_reason = $1, updated_at = NOW()
       WHERE user_id = $2 AND status = 'active' RETURNING *`,
      [reason, userId]
    );
    if (result.rows.length === 0) throw new Error('No active subscription found');
    return result.rows[0];
  }

  /**
   * Get payment history.
   */
  static async getPaymentHistory(userId: string) {
    const result = await pool.query(
      `SELECT p.id, p.amount, p.discount_amount, p.tax_amount, p.final_amount, p.currency, p.status, p.created_at, p.billing_cycle, p.razorpay_payment_id, pl.name as plan_name
       FROM public.payments p
       JOIN public.plans pl ON pl.id = p.plan_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}
