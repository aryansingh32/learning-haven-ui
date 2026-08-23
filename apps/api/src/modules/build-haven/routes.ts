import { Router } from 'express';
import { authenticateUser, optionalAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { BuildHavenController } from './controller';
import { GitHubController } from '../github/github.controller';
import { requireIdempotencyKey } from '../../middleware/idempotency';
import { webhookRateLimit, writeRateLimit } from '../../middleware/rateLimit';
import { requireEntitlement } from '../entitlements/entitlements.middleware';

const router = Router();

router.get('/challenges', BuildHavenController.listChallenges);
router.get('/challenges/:slug', BuildHavenController.getChallengeBySlug);
router.get('/challenges/:slug/leaderboard', BuildHavenController.getLeaderboard);
router.get('/challenges/:slug/workspace', authenticateUser, BuildHavenController.getWorkspace);
router.post(
  '/challenges/:slug/start',
  authenticateUser,
  requireEntitlement('challenge_limit'),
  writeRateLimit,
  requireIdempotencyKey,
  BuildHavenController.startChallenge
);
router.get('/enrollments', authenticateUser, BuildHavenController.getMyEnrollments);
router.post('/challenges/:slug/stages/:stageNumber/celebrate', authenticateUser, BuildHavenController.celebrateStage);
router.get('/progress/:username/:slug/badge.svg', BuildHavenController.getProgressBadge);
router.post('/webhooks/github', optionalAuth, webhookRateLimit, requireIdempotencyKey, GitHubController.webhookReceiver);
// Vibe mode: authenticated user submits their build for gate verification
router.post(
  '/enrollments/:enrollmentId/stages/:stageId/vibe-submit',
  authenticateUser,
  writeRateLimit,
  BuildHavenController.vibeSubmitStage
);

const adminRouter = Router();
adminRouter.use(authenticateUser, requireAdmin);
adminRouter.get('/challenges', BuildHavenController.adminListChallenges);
adminRouter.post('/challenges', BuildHavenController.adminCreateChallenge);
adminRouter.post('/challenges/bulk-delete', BuildHavenController.adminBulkDeleteChallenges);
adminRouter.get('/challenges/:id', BuildHavenController.adminGetChallenge);
adminRouter.put('/challenges/:id', BuildHavenController.adminUpdateChallenge);
adminRouter.delete('/challenges/:id', BuildHavenController.adminArchiveChallenge);
adminRouter.delete('/challenges/:id/permanent', BuildHavenController.adminHardDeleteChallenge);
adminRouter.get('/challenges/:id/analytics', BuildHavenController.adminGetAnalytics);

adminRouter.get('/challenges/:programId/stages', BuildHavenController.adminListStages);
adminRouter.post('/challenges/:programId/stages', BuildHavenController.adminCreateStage);
adminRouter.put('/stages/:stageId', BuildHavenController.adminUpdateStage);
adminRouter.delete('/stages/:stageId', BuildHavenController.adminDeleteStage);
adminRouter.put('/challenges/:programId/stages/reorder', BuildHavenController.adminReorderStages);

adminRouter.get('/challenges/:programId/languages', BuildHavenController.adminListLanguages);
adminRouter.post('/challenges/:programId/languages', BuildHavenController.adminUpsertLanguage);
adminRouter.put('/languages/:langId', BuildHavenController.adminUpdateLanguage);
adminRouter.delete('/challenges/:programId/languages/:language', BuildHavenController.adminDeleteLanguage);
adminRouter.delete('/languages/:langId', BuildHavenController.adminDeleteLanguageById);

adminRouter.get('/challenges/:programId/enrollments', BuildHavenController.adminListEnrollments);
adminRouter.post('/enrollments/:enrollmentId/stages/:stageId/pass', BuildHavenController.adminManualPassStage);

router.use('/admin', adminRouter);

export default router;
