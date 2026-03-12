import { Router } from 'express';
import authRoutes from './auth';
import problemsRoutes from './problems';
import usersRoutes from './users';
import submissionsRoutes from './submissions';
import paymentsRoutes from './payments';
import subscriptionsRoutes from './subscriptions';
import referralsRoutes from './referrals';
import aiRoutes from './ai';
import certificatesRoutes from './certificates';
import adminRoutes from './admin';
import tasksRoutes from './tasks';
import roadmapsRoutes from './roadmaps';
import categoriesRoutes from './categories';
import feedbackRoutes from './feedback';
import executeRoutes from './execute';
import chaptersRoutes from './chapters';
import cronRoutes from './cron';
import jobsRoutes from './jobs';
import { SubmissionsController } from '../controllers/submissions.controller';
import settingsRoutes from './settings';
import resumeRoutes from './resume';
import whatsappRoutes from './whatsapp';

const router = Router();

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
router.use('/roadmaps', roadmapsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/execute', executeRoutes);
router.use('/chapters', chaptersRoutes);
router.use('/cron', cronRoutes);
router.use('/jobs', jobsRoutes);
router.use('/settings', settingsRoutes);
router.use('/resume', resumeRoutes);
router.use('/whatsapp', whatsappRoutes);

// Leaderboard alias (also available at /submissions/leaderboard)
router.get('/leaderboard', SubmissionsController.getLeaderboard);

export default router;
