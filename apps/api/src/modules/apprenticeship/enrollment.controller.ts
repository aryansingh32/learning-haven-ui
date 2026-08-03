import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { fail, ok } from './http';
import { supabase } from '../../config/database';
import logger from '../../config/logger';
import razorpay, { verifyPaymentSignature } from '../../config/razorpay';
import { ReferralsService } from '../billing/services/referrals.service';
import { sendApprenticeshipWelcomeEmail } from '../communication/services/email.service';

async function validateCoupon(programId: string, couponCode?: string, userId?: string) {
  if (!couponCode) {
    return { coupon: null, discountAmount: 0 };
  }

  const { data: coupon, error } = await supabase
    .from('apprenticeship_coupons')
    .select('*')
    .eq('code', couponCode.trim().toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!coupon) {
    throw new Error('Invalid coupon code');
  }

  if (coupon.program_id && coupon.program_id !== programId) {
    throw new Error('Coupon does not apply to this program');
  }

  if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
    throw new Error('Coupon is not active yet');
  }

  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    throw new Error('Coupon has expired');
  }

  if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
    throw new Error('Coupon usage limit reached');
  }

  if (userId) {
    const { data: existing } = await supabase
      .from('apprenticeship_enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('referral_code', coupon.code);

    if ((existing || []).length >= (coupon.per_user_limit || 1)) {
      throw new Error('Coupon already used');
    }
  }

  return { coupon, discountAmount: 0 };
}

function computeDiscount(price: number, coupon: any) {
  if (!coupon) return 0;
  if (coupon.discount_type === 'fixed') return Math.min(price, coupon.discount_value || 0);
  return Math.min(price, Math.round(price * ((coupon.discount_value || 0) / 100)));
}

export class EnrollmentController {
  static async createOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { programId, couponCode } = req.body;

      if (!programId) {
        return res.status(400).json(fail('programId is required', 'E_ENROLL_400'));
      }

      const { data: program, error: programError } = await supabase
        .from('apprenticeship_programs')
        .select('*')
        .eq('id', programId)
        .eq('status', 'active')
        .maybeSingle();

      if (programError) throw programError;
      if (!program) {
        return res.status(404).json(fail('Program not found', 'E_ENROLL_404'));
      }

      const { data: existingEnrollment } = await supabase
        .from('apprenticeship_enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('program_id', programId)
        .maybeSingle();

      if (existingEnrollment) {
        return res.status(409).json(fail('Already enrolled in this program', 'E_ENROLL_409'));
      }

      if (program.max_enrollments && (program.enrolled_count || 0) >= program.max_enrollments) {
        return res.status(410).json(fail('Program is full', 'E_ENROLL_002'));
      }

      const { coupon } = await validateCoupon(programId, couponCode, userId);
      const discountAmount = computeDiscount(program.price_inr, coupon);
      const finalAmount = Math.max(0, program.price_inr - discountAmount);

      const order = await razorpay.orders.create({
        amount: finalAmount,
        currency: 'INR',
        receipt: `appr_${programId.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: userId,
          program_id: programId,
          program_title: program.title,
          coupon_code: coupon?.code || '',
        },
      });

      await supabase.from('payments').insert({
        user_id: userId,
        razorpay_order_id: order.id,
        amount: finalAmount,
        currency: 'INR',
        status: 'created',
        description: `${program.title} Apprenticeship`,
        metadata: {
          program_id: programId,
          original_amount: program.price_inr,
          discount_amount: discountAmount,
          coupon_code: coupon?.code || null,
          type: 'apprenticeship',
        },
      });

      res.json(ok({
        order_id: order.id,
        amount: finalAmount,
        currency: 'INR',
        original_amount: program.price_inr,
        discount_amount: discountAmount,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      }));
    } catch (error: any) {
      logger.error('Error creating apprenticeship order:', error);
      res.status(500).json(fail(error.message || 'Failed to create order', 'E_ENROLL_500'));
    }
  }

  static async enroll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { programId, paymentId, orderId, signature, referralCode, couponCode } = req.body;

      if (!programId || !paymentId || !orderId || !signature) {
        return res.status(400).json(fail('programId, paymentId, orderId and signature are required', 'E_ENROLL_400'));
      }

      const isValid = verifyPaymentSignature(orderId, paymentId, signature);
      if (!isValid) {
        return res.status(400).json(fail('Payment verification failed', 'E_ENROLL_401'));
      }

      const { data: existingEnrollment } = await supabase
        .from('apprenticeship_enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('program_id', programId)
        .maybeSingle();

      if (existingEnrollment) {
        return res.json(ok({ enrollment: existingEnrollment, alreadyEnrolled: true }));
      }

      const { data: program, error: programError } = await supabase
        .from('apprenticeship_programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (programError || !program) {
        return res.status(404).json(fail('Program not found', 'E_ENROLL_404'));
      }

      const { data: payment } = await supabase
        .from('payments')
        .update({
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          status: 'captured',
        })
        .eq('razorpay_order_id', orderId)
        .select('id, metadata')
        .single();

      const { data: projects, error: projectsError } = await supabase
        .from('apprenticeship_projects')
        .select('id, sort_order')
        .eq('program_id', programId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (projectsError) throw projectsError;

      const enrolledAt = new Date();
      const expiresAt = new Date(enrolledAt.getTime() + (program.duration_days || 0) * 24 * 60 * 60 * 1000);
      const totalProjects = projects?.length || 0;

      const { data: enrollment, error: enrollmentError } = await supabase
        .from('apprenticeship_enrollments')
        .insert({
          user_id: userId,
          program_id: programId,
          payment_id: payment?.id || null,
          referral_code: couponCode || null,
          learning_path: 'traditional',
          enrolled_at: enrolledAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          current_project_number: 1,
          completed_projects: 0,
          total_projects: totalProjects,
          progress_percentage: 0,
          status: 'active',
        })
        .select()
        .single();

      if (enrollmentError || !enrollment) throw enrollmentError;

      if ((projects || []).length > 0) {
        const rows = projects!.map((project: any, index: number) => ({
          enrollment_id: enrollment.id,
          project_id: project.id,
          user_id: userId,
          status: index === 0 ? 'available' : 'locked',
        }));

        const { error } = await supabase
          .from('apprenticeship_project_progress')
          .insert(rows);
        if (error) throw error;
      }

      await supabase
        .from('apprenticeship_programs')
        .update({ enrolled_count: (program.enrolled_count || 0) + 1 })
        .eq('id', programId);

      if (referralCode) {
        try {
          await ReferralsService.applyReferralCode(userId, referralCode, req.ip);
        } catch (referralError: any) {
      logger.error('Error:', referralError);
          logger.warn('Failed to apply apprenticeship referral code', referralError);
        }
      }

      const { data: user } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle();

      if (user?.email) {
        await sendApprenticeshipWelcomeEmail({
          to: user.email,
          name: user.full_name || 'Student',
          programTitle: program.title,
          discordInviteLink: process.env.APPRENTICESHIP_DISCORD_INVITE || null,
        });
      }

      res.status(201).json(ok({
        enrollment,
        discord_invite_link: process.env.APPRENTICESHIP_DISCORD_INVITE || null,
      }));
    } catch (error: any) {
      logger.error('Error enrolling in apprenticeship:', error);
      res.status(500).json(fail(error.message || 'Failed to create enrollment', 'E_ENROLL_501'));
    }
  }
}
