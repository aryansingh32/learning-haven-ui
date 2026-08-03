import { Router } from 'express';
import { z } from 'zod';
import { signup, signin, signout, refreshSession } from '../controllers/auth.controller';
import { phoneSendOtp, phoneVerifyOtp, phoneCompleteProfile } from '../controllers/auth-phone.controller';
import { validate } from '../../../middleware/validate';
import { authRateLimit, otpRateLimit } from '../../../middleware/rateLimit';

const router = Router();

// ── Zod schemas ─────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required').max(100),
  referral_code: z.string().optional(),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

// ── Routes ──────────────────────────────────────────────
router.post('/signup', authRateLimit, validate(signupSchema), signup);
router.post('/signin', authRateLimit, validate(signinSchema), signin);
router.post('/refresh', validate(refreshSchema), refreshSession);
router.post('/signout', signout);

// Phone OTP Auth Routes (MSG91)
router.post('/phone-send-otp', otpRateLimit, phoneSendOtp);
router.post('/phone-verify-otp', otpRateLimit, phoneVerifyOtp);
router.post('/phone-complete-profile', phoneCompleteProfile);

export default router;
