import { Router } from 'express';
import { signup, signin, signout } from '../controllers/auth.controller';
import { phoneSendOtp, phoneVerifyOtp, phoneCompleteProfile } from '../controllers/auth-phone.controller';

const router = Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/signout', signout);

// Phone OTP Auth Routes (MSG91)
router.post('/phone-send-otp', phoneSendOtp);
router.post('/phone-verify-otp', phoneVerifyOtp);
router.post('/phone-complete-profile', phoneCompleteProfile);

export default router;
