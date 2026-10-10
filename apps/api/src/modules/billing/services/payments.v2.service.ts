import { pool } from '../../../config/database';
import { calculateGST, getSubscriptionEndDate } from '../../../utils/plans';
import { InvoiceService } from './invoice.service';
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
   * Create a Razorpay order for an individually-priced course (no plan required).
   * Prices directly from public.courses.price rather than the plans table.
   */
  static async createCourseOrder(userId: string, courseId: string, couponCode?: string) {
    // 1. Fetch course
    const courseRes = await pool.query(
      `SELECT id, title, price, currency, is_individually_purchasable
         FROM public.courses
         WHERE id = $1 AND is_published = true`,
      [courseId]
    );
    if (courseRes.rows.length === 0) throw new Error('Course not found or not published');
    const course = courseRes.rows[0];
    if (!course.is_individually_purchasable || course.price == null) {
      throw new Error('This course is not available for individual purchase');
    }

    // 2. Check if already entitled
    const entitled = await pool.query(
      `SELECT 1 FROM public.user_entitlements
         WHERE user_id = $1 AND feature_key = 'course_access'
           AND resource_type = 'course' AND resource_id = $2 AND bool_value = true`,
      [userId, courseId]
    );
    if (entitled.rows.length > 0) throw new Error('You already have access to this course');

    // 3. Apply coupon (reuse existing coupon validation if code provided)
    let discountAmount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const cv = await this.validateCoupon(couponCode, 'course_one_time', userId, course.price);
      if (!cv.valid) throw new Error(cv.reason);
      discountAmount = cv.discountAmount;
      couponId = cv.coupon.id;
    }

    const discountedPrice = Math.max(0, course.price - discountAmount);
    const gstInfo = calculateGST(discountedPrice);
    const finalAmountInPaise = gstInfo.total;

    if (finalAmountInPaise < 100 && finalAmountInPaise > 0) {
      throw new Error('Final amount cannot be less than ₹1');
    }

    // 4. Create Razorpay order
    let razorpayOrderId = `free_course_${Date.now()}_${userId.slice(0, 8)}`;
    if (finalAmountInPaise > 0) {
      const order = await razorpay.orders.create({
        amount: finalAmountInPaise,
        currency: course.currency || 'INR',
        receipt: `course_${courseId.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: userId, course_id: courseId, purchase_kind: 'course' },
      });
      razorpayOrderId = order.id;
    }

    // 5. Insert payment record (plan_id is null for course-only purchases)
    const paymentResult = await pool.query(
      `INSERT INTO public.payments (
           user_id, plan_id, amount, discount_amount, tax_amount, final_amount,
           status, razorpay_order_id, coupon_id, coupon_code, billing_cycle, description, metadata
         ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
      [
        userId, course.price, discountAmount, gstInfo.gst_amount, finalAmountInPaise,
        'created', razorpayOrderId, couponId, couponCode, 'one_time',
        `${course.title} (one-time purchase)`,
        { purchase_kind: 'course', resource_type: 'course', resource_id: courseId },
      ]
    );

    return {
      orderId: paymentResult.rows[0].id,
      razorpayOrderId,
      amount: course.price,
      discountAmount,
      taxAmount: gstInfo.gst_amount,
      finalAmount: finalAmountInPaise,
      currency: course.currency || 'INR',
      course: { id: course.id, title: course.title },
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Create a Razorpay order for a course bundle: every course in it, for the bundle's price.
   * Courses the learner already has stay as they are; a bundle with nothing new can't be bought.
   */
  static async createBundleOrder(userId: string, bundleId: string, couponCode?: string) {
    const bundle = (await pool.query(
      `SELECT id, title, price, currency FROM public.course_bundles
        WHERE id = $1 AND is_published AND deleted_at IS NULL`, [bundleId])).rows[0];
    if (!bundle) throw new Error('Bundle not found');
    const courseIds: string[] = (await pool.query(
      `SELECT i.course_id FROM public.course_bundle_items i JOIN public.courses c ON c.id = i.course_id
        WHERE i.bundle_id = $1 AND c.deleted_at IS NULL AND c.is_published ORDER BY i.sort_order`, [bundleId])).rows.map((r) => r.course_id);
    if (courseIds.length === 0) throw new Error('This bundle has no courses yet');
    const owned = (await pool.query(
      `SELECT resource_id FROM public.user_entitlements
        WHERE user_id = $1 AND feature_key = 'course_access' AND resource_type = 'course' AND bool_value = true
          AND resource_id = ANY($2::uuid[]) AND (expires_at IS NULL OR expires_at > NOW())`, [userId, courseIds])).rows.length;
    if (owned === courseIds.length) throw new Error('You already have every course in this bundle');

    let discountAmount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const cv = await this.validateCoupon(couponCode, 'bundle_one_time', userId, bundle.price);
      if (!cv.valid) throw new Error(cv.reason);
      discountAmount = cv.discountAmount;
      couponId = cv.coupon.id;
    }
    const gstInfo = calculateGST(Math.max(0, bundle.price - discountAmount));
    const finalAmountInPaise = gstInfo.total;
    if (finalAmountInPaise < 100 && finalAmountInPaise > 0) throw new Error('Final amount cannot be less than ₹1');

    let razorpayOrderId = `free_bundle_${Date.now()}_${userId.slice(0, 8)}`;
    if (finalAmountInPaise > 0) {
      const order = await razorpay.orders.create({
        amount: finalAmountInPaise,
        currency: bundle.currency || 'INR',
        receipt: `bundle_${bundleId.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: userId, bundle_id: bundleId, purchase_kind: 'bundle' },
      });
      razorpayOrderId = order.id;
    }
    const paymentResult = await pool.query(
      `INSERT INTO public.payments (
           user_id, plan_id, amount, discount_amount, tax_amount, final_amount,
           status, razorpay_order_id, coupon_id, coupon_code, billing_cycle, description, metadata
         ) VALUES ($1, NULL, $2, $3, $4, $5, 'created', $6, $7, $8, 'one_time', $9, $10)
         RETURNING id`,
      [userId, bundle.price, discountAmount, gstInfo.gst_amount, finalAmountInPaise, razorpayOrderId, couponId, couponCode ?? null,
        `${bundle.title} (bundle, one-time purchase)`,
        // The courses are fixed at purchase time, so a later edit of the bundle doesn't change what was bought.
        { purchase_kind: 'bundle', resource_type: 'bundle', resource_id: bundleId, course_ids: courseIds }]
    );
    return {
      orderId: paymentResult.rows[0].id,
      razorpayOrderId,
      amount: bundle.price,
      discountAmount,
      taxAmount: gstInfo.gst_amount,
      finalAmount: finalAmountInPaise,
      currency: bundle.currency || 'INR',
      bundle: { id: bundle.id, title: bundle.title, courses: courseIds.length },
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Turn a paid order into access, inside the caller's transaction: a plan becomes the
   * active subscription; a course, bundle or other resource becomes entitlements linked
   * to this payment. Used by both the checkout callback and the Razorpay webhook.
   */
  private static async activate(client: any, payment: any, razorpayPaymentId: string, razorpaySignature: string | null) {
    const userId: string = payment.user_id;
    await client.query(
      `UPDATE public.payments SET status = 'captured', razorpay_payment_id = $1,
              razorpay_signature = COALESCE($2, razorpay_signature), updated_at = NOW() WHERE id = $3`,
      [razorpayPaymentId, razorpaySignature, payment.id]
    );

    const meta = payment.metadata || {};
    const plan = payment.plan_id
      ? (await client.query(`SELECT slug, name FROM public.plans WHERE id = $1`, [payment.plan_id])).rows[0] ?? null
      : null;
    const now = new Date();
    const periodEnd = getSubscriptionEndDate(payment.billing_cycle, now);

    // What this payment unlocks, besides a plan.
    const grants: Array<{ feature: string; type: string; id: string }> = [];
    if (meta.resource_type === 'bundle') {
      for (const courseId of (meta.course_ids ?? []) as string[]) grants.push({ feature: 'course_access', type: 'course', id: courseId });
    } else if (this.featureForResource(meta.resource_type) && meta.resource_id) {
      grants.push({ feature: this.featureForResource(meta.resource_type)!, type: meta.resource_type, id: meta.resource_id });
    }

    let subscriptionId: string | null = null;
    if (plan && grants.length === 0) {
      // Plan purchase: replace the active subscription.
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
        [plan.slug, subscriptionId, userId]
      );
    }

    const label = plan ? `${plan.name} access` : (payment.description || 'Purchase');
    for (const g of grants) {
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
           updated_at = NOW()
         -- A course already owned for at least as long keeps its own record (and its own refund).
         WHERE public.user_entitlements.bool_value = false
            OR (public.user_entitlements.expires_at IS NOT NULL AND public.user_entitlements.expires_at < EXCLUDED.expires_at)`,
        [userId, g.feature, g.type, g.id, label, payment.id, subscriptionId, periodEnd,
          { plan_slug: plan?.slug ?? null, billing_cycle: payment.billing_cycle, ...(meta.resource_type === 'bundle' ? { bundle_id: meta.resource_id } : {}) }]
      );
    }

    if (payment.coupon_id) {
      await client.query(
        `INSERT INTO public.coupon_usages (coupon_id, user_id, payment_id, discount_applied) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [payment.coupon_id, userId, payment.id, payment.discount_amount]
      );
      await client.query(`UPDATE public.coupons SET used_count = used_count + 1 WHERE id = $1`, [payment.coupon_id]);
    }

    return { subscriptionId, plan, label, courseIds: grants.filter((g) => g.type === 'course').map((g) => g.id) };
  }

  /** After the transaction: caches, the GST invoice and follow-up jobs. */
  private static async afterActivation(userId: string, paymentId: string, label: string) {
    await CacheService.delPattern(`entitlements:${userId}`);
    await CacheService.delPattern(`content_entitlements:${userId}`);
    await CacheService.del(`user_plan:${userId}`);
    await CacheService.delPattern(`plan_entitlements:*`);
    await InvoiceService.issueQuietly(paymentId);
    await monetizationQueue.add('referral.check-and-activate', { userId, paymentId });
    await monetizationQueue.add('payment.welcome-email', { userId, planName: label });
  }

  /**
   * Verify the checkout callback and activate what was bought.
   */
  static async verifyAndActivate(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    // Fully discounted orders never reach Razorpay, so there is no signature; they must really be free.
    const isFree = razorpayOrderId.startsWith('free_');
    if (!isFree) {
      const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!isValid) throw new Error('Payment verification failed');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const payment = (await client.query(
        `SELECT * FROM public.payments WHERE razorpay_order_id = $1 FOR UPDATE`,
        [razorpayOrderId]
      )).rows[0];
      // Someone else's order is "not found", whatever they hold.
      if (!payment || payment.user_id !== userId) throw new Error('Payment not found');
      if (isFree && Number(payment.final_amount) > 0) throw new Error('Payment verification failed');

      if (payment.status === 'captured') {
        await client.query('COMMIT');
        return { success: true, message: 'Payment already processed' }; // Idempotent
      }

      const result = await this.activate(client, payment, razorpayPaymentId, isFree ? null : razorpaySignature);
      await client.query('COMMIT');
      await this.afterActivation(userId, payment.id, result.label);

      return {
        success: true,
        subscriptionId: result.subscriptionId,
        plan: result.plan ? { name: result.plan.name, slug: result.plan.slug } : null,
        courseIds: result.courseIds,
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

        // Payment is still 'created' (the checkout callback never arrived) — activate now.
        logger.info(`Webhook activating order ${orderId}, payment ${paymentId}`);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const locked = (await client.query(`SELECT * FROM public.payments WHERE id = $1 FOR UPDATE`, [payment.id])).rows[0];
          if (!locked || locked.status === 'captured') {
            await client.query('COMMIT');
            return;
          }
          const result = await this.activate(client, locked, paymentId, null);
          await client.query('COMMIT');
          await this.afterActivation(locked.user_id, locked.id, result.label);
          logger.info(`Webhook activated order ${orderId} for user ${locked.user_id}`);
        } catch (e) {
          await client.query('ROLLBACK');
          logger.error('Webhook activation error:', e);
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
        const paymentRes = await client.query(`SELECT id, user_id, subscription_id FROM public.payments WHERE razorpay_payment_id = $1`, [paymentId]);
        if (paymentRes.rows.length > 0) {
          const p = paymentRes.rows[0];
          await client.query(`UPDATE public.payments SET status = 'refunded' WHERE id = $1`, [p.id]);
          // Courses, bundles and other things bought with this payment stop working.
          await client.query(
            `UPDATE public.user_entitlements SET bool_value = false, updated_at = NOW() WHERE source_payment_id = $1`, [p.id]);
          // A plan is cancelled only when this payment paid for it.
          if (p.subscription_id) {
            await client.query(`UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`, [p.subscription_id]);
            await client.query(
              `UPDATE public.users SET current_plan = 'free', active_subscription_id = NULL WHERE id = $1 AND active_subscription_id = $2`,
              [p.user_id, p.subscription_id]);
          }
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
    const query = (withInvoices: boolean) => pool.query(
      `SELECT p.id, p.amount, p.discount_amount, p.tax_amount, p.final_amount, p.currency, p.status, p.created_at, p.billing_cycle, p.razorpay_payment_id, pl.name as plan_name,
              p.description, ${withInvoices ? 'inv.invoice_no' : 'null::text as invoice_no'}
       FROM public.payments p
       JOIN public.plans pl ON pl.id = p.plan_id
       ${withInvoices ? 'LEFT JOIN public.invoices inv ON inv.payment_id = p.id' : ''}
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );
    // Before the invoices migration is applied the history still works, just without invoice numbers.
    const result = await query(true).catch((e) => (e?.code === '42P01' ? query(false) : Promise.reject(e)));
    return result.rows;
  }
}
