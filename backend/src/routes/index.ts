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
import { SubmissionsController } from '../controllers/submissions.controller';

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

// Leaderboard alias (also available at /submissions/leaderboard)
router.get('/leaderboard', SubmissionsController.getLeaderboard);

export default router;
