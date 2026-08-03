import { Router } from 'express';
import authRoutes from '../../auth/routes/auth';
import problemsRoutes from '../../learning/routes/problems';
import usersRoutes from '../../auth/routes/users';
import submissionsRoutes from '../../learning/routes/submissions';
import paymentsRoutes from '../../billing/routes/payments';
import subscriptionsRoutes from '../../billing/routes/subscriptions';
import referralsRoutes from '../../billing/routes/referrals';
import aiRoutes from '../../execution/routes/ai';
import certificatesRoutes from '../../learning/routes/certificates';
import adminRoutes from '../../admin/routes/admin';
import tasksRoutes from '../../apprenticeship/routes/tasks';
import coursesRoutes from '../../learning/routes/courses';
import categoriesRoutes from '../../learning/routes/categories';
import feedbackRoutes from '../../learning/routes/feedback';
import executeRoutes from '../../execution/routes/execute';
import chaptersRoutes from '../../learning/routes/chapters';
import cronRoutes from './cron';
import jobsRoutes from '../../apprenticeship/routes/jobs';
import { SubmissionsController } from '../../learning/controllers/submissions.controller';
import settingsRoutes from '../../auth/routes/settings';
import resumeRoutes from '../../apprenticeship/routes/resume';
import whatsappRoutes from '../../communication/routes/whatsapp';
import apprenticeshipRoutes from '../../apprenticeship/routes';
import buildHavenRoutes from '../../build-haven/routes';
import analyticsRoutes from './analytics.routes';
import entitlementsRoutes from '../../entitlements/entitlements.routes';
import paymentsV2Routes from '../../billing/routes/payments.v2';
import referralsV2Routes from '../../billing/routes/referrals.v2';
import plansRoutes from '../../plans/plans.routes';

const router = Router();

router.use('/analytics', analyticsRoutes);
router.use('/entitlements', entitlementsRoutes);
router.use('/plans', plansRoutes);
router.use('/v2/payments', paymentsV2Routes);
router.use('/v2/referrals', referralsV2Routes);

router.use('/auth', authRoutes);
router.use('/problems', problemsRoutes);
router.use('/users', usersRoutes);
router.use('/submissions', submissionsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/referrals', referralsRoutes);
router.use('/ai', aiRoutes);
router.use('/certificates', certificatesRoutes);
router.use('/admin', adminRoutes);
router.use('/tasks', tasksRoutes);
router.use('/courses', coursesRoutes);
router.use('/categories', categoriesRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/execute', executeRoutes);
router.use('/chapters', chaptersRoutes);
router.use('/cron', cronRoutes);
router.use('/jobs', jobsRoutes);
router.use('/settings', settingsRoutes);
router.use('/resume', resumeRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/v1/apprenticeship', apprenticeshipRoutes);
router.use('/v1/build', buildHavenRoutes);

// Leaderboard alias (also available at /submissions/leaderboard)
router.get('/leaderboard', SubmissionsController.getLeaderboard);

export default router;
