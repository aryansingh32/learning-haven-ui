import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { ApprenticeshipController } from './programs.controller';
import { AuthRequest, authenticateUser, optionalAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { SubmissionsController } from './submissions.controller';
import { GitHubController } from '../github/github.controller';
import { TrackingController } from './tracking.controller';
import { apprenticeshipTracker } from '../../middleware/apprenticeshipTracker';
import redis from '../../config/redis';
import { CommunityController } from './community.controller';
import { AIHelpController } from './ai-help.controller';
import { EnrollmentController } from './enrollment.controller';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import { submissionRateLimit, webhookRateLimit, writeRateLimit } from '../../middleware/rateLimit';
import { requireAndConsumeEntitlement, requireEntitlement } from '../entitlements/entitlements.middleware';

const router = Router();

const aiHelpRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `ai:appr:${(req as AuthRequest).user?.id || 'anonymous'}`,
  store: new RedisStore({ sendCommand: (...args: string[]) => (redis as any).call(...args) }),
  message: { success: false, error: 'AI help rate limit exceeded. 10 queries per hour.', code: 'E_AI_429' },
});

const trackingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
});

router.get('/programs', apprenticeshipTracker('page_view', 'navigation'), ApprenticeshipController.listPrograms);
router.get('/programs/:slug', apprenticeshipTracker('program_page_viewed', 'navigation'), ApprenticeshipController.getProgramBySlug);
router.get('/leaderboard/:programId', ApprenticeshipController.getLeaderboard);
router.get('/certificates/verify/:code', apprenticeshipTracker('certificate_viewed', 'certificate'), ApprenticeshipController.verifyCertificate);

router.post('/track', optionalAuth, trackingRateLimit, TrackingController.ingest);
router.post('/payments/create-order', authenticateUser, writeRateLimit, requireIdempotencyKey, apprenticeshipTracker('checkout_initiated', 'payment'), EnrollmentController.createOrder);
router.post('/enroll', authenticateUser, writeRateLimit, requireIdempotencyKey, apprenticeshipTracker('enrollment_completed', 'payment'), EnrollmentController.enroll);
router.get('/enrollments/mine', authenticateUser, ApprenticeshipController.getMyEnrollments);
router.get('/enrollments/:enrollmentId', authenticateUser, ApprenticeshipController.getEnrollmentDetail);
router.get('/projects/:projectId', authenticateUser, requireEntitlement('project_access'), apprenticeshipTracker('page_view', 'navigation'), ApprenticeshipController.getProjectWorkspace);
router.post('/projects/:projectId/start', authenticateUser, requireEntitlement('project_access'), submissionRateLimit, requireIdempotencyKey, apprenticeshipTracker('project_started', 'verification'), ApprenticeshipController.startProject);
router.get('/submissions/mine', authenticateUser, SubmissionsController.getMySubmissions);
router.get('/submissions/:id/status', authenticateUser, SubmissionsController.getSubmissionStatus);
router.get('/submissions/:id/stages', authenticateUser, SubmissionsController.getTestStages);
router.get('/community/:programId/posts', authenticateUser, CommunityController.listPosts);
router.post('/community/:programId/posts', authenticateUser, apprenticeshipTracker('community_post_created', 'community'), CommunityController.createPost);
router.post('/community/posts/:postId/upvote', authenticateUser, apprenticeshipTracker('community_post_upvoted', 'community'), CommunityController.toggleUpvote);
router.post('/community/posts/:postId/replies', authenticateUser, apprenticeshipTracker('community_reply_created', 'community'), CommunityController.createReply);
router.post('/ai/project-help', authenticateUser, requireAndConsumeEntitlement('ai_project_help_per_day'), aiHelpRateLimit, apprenticeshipTracker('ai_help_query', 'ai'), AIHelpController.getHelp);
router.get('/auth/github/status', authenticateUser, GitHubController.getStatus);
router.get('/auth/github', authenticateUser, apprenticeshipTracker('github_connect_initiated', 'github'), GitHubController.getAuthUrl);
router.get('/auth/github/callback', GitHubController.authCallback);
router.delete('/auth/github', authenticateUser, ApprenticeshipController.disconnectGitHub);
router.post('/webhooks/github', optionalAuth, webhookRateLimit, requireIdempotencyKey, GitHubController.webhookReceiver);

const adminRouter = Router();
adminRouter.use(authenticateUser, requireAdmin);

adminRouter.get('/programs', ApprenticeshipController.adminListPrograms);
adminRouter.get('/programs/:id', ApprenticeshipController.adminGetProgram);
adminRouter.post('/programs', ApprenticeshipController.adminCreateProgram);
adminRouter.put('/programs/:id', ApprenticeshipController.adminUpdateProgram);
adminRouter.delete('/programs/:id', ApprenticeshipController.adminArchiveProgram);
adminRouter.put('/programs/:id/reorder-projects', ApprenticeshipController.adminReorderProjects);
adminRouter.get('/programs/:programId/projects', ApprenticeshipController.adminListProjects);
adminRouter.post('/programs/:programId/projects', ApprenticeshipController.adminCreateProject);
adminRouter.get('/projects/:id', ApprenticeshipController.adminGetProject);
adminRouter.put('/projects/:id', ApprenticeshipController.adminUpdateProject);
adminRouter.delete('/projects/:id', ApprenticeshipController.adminDeleteProject);
adminRouter.get('/overview', ApprenticeshipController.adminOverview);
adminRouter.get('/submissions', ApprenticeshipController.adminListSubmissions);
adminRouter.put('/submissions/:id/review', ApprenticeshipController.adminReviewSubmission);
adminRouter.get('/students', ApprenticeshipController.adminStudents);
adminRouter.get('/students/:userId', ApprenticeshipController.adminStudentDetail);
adminRouter.get('/analytics', ApprenticeshipController.adminAnalytics);
adminRouter.get('/coupons', ApprenticeshipController.adminCoupons);
adminRouter.post('/coupons', ApprenticeshipController.adminCreateCoupon);
adminRouter.put('/coupons/:id', ApprenticeshipController.adminUpdateCoupon);
adminRouter.delete('/coupons/:id', ApprenticeshipController.adminDeleteCoupon);
adminRouter.post('/notifications/broadcast', ApprenticeshipController.adminBroadcastNotification);

router.use('/admin', adminRouter);

export default router;
