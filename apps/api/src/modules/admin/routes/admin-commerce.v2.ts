import { Router } from 'express';
import { AdminCommerceV2Controller } from '../controllers/admin-commerce.v2.controller';
import { requireAdmin } from '../../../middleware/requireAdmin';

const router = Router();

// All routes require admin
router.use(requireAdmin);

// Plans & Entitlements
router.get('/plans', AdminCommerceV2Controller.getPlans);
router.post('/plans', AdminCommerceV2Controller.createPlan);
router.patch('/plans/:id', AdminCommerceV2Controller.updatePlan);
router.delete('/plans/:id', AdminCommerceV2Controller.deletePlan);
router.get('/plans/:id/entitlements', AdminCommerceV2Controller.getPlanEntitlements);
router.post('/plans/:id/entitlements', AdminCommerceV2Controller.upsertEntitlement);
router.delete('/plans/:id/entitlements/:entitlementId', AdminCommerceV2Controller.deleteEntitlement);

// Coupons
router.get('/coupons', AdminCommerceV2Controller.getCoupons);
router.post('/coupons', AdminCommerceV2Controller.createCoupon);
router.patch('/coupons/:id/toggle', AdminCommerceV2Controller.toggleCoupon);

// Referrals
router.get('/referrals/suspicious', AdminCommerceV2Controller.getSuspiciousReferrals);
router.post('/referrals/:id/review', AdminCommerceV2Controller.reviewReferral);
router.post('/referrals/influencer', AdminCommerceV2Controller.createInfluencerCode);

// Withdrawals
router.get('/withdrawals/pending', AdminCommerceV2Controller.getPendingWithdrawals);
router.post('/withdrawals/:id/process', AdminCommerceV2Controller.processWithdrawal);

export default router;
