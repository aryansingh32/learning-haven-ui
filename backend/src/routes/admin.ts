import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateUser } from '../middleware/auth';
import { requireAdmin, requireSuperAdmin } from '../middleware/requireAdmin';
import { adminLogging } from '../middleware/adminLogging';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateUser, requireAdmin, adminLogging);

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
router.get('/dashboard', AdminController.getDashboard);

// ══════════════════════════════════════════════════════════
// ANALYTICS REPORTS
// ══════════════════════════════════════════════════════════
router.get('/analytics', AdminController.getAnalyticsReport);

// ══════════════════════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════════════════════
router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.getUserDetail);
router.put('/users/:id/role', requireSuperAdmin, AdminController.updateUserRole);
router.put('/users/:id/ban', AdminController.toggleUserBan);

// ══════════════════════════════════════════════════════════
// PROBLEM MANAGEMENT
// ══════════════════════════════════════════════════════════
router.post('/problems', AdminController.createProblem);
router.put('/problems/:id', AdminController.updateProblem);
router.delete('/problems/:id', AdminController.deleteProblem);
router.post('/problems/import', AdminController.importProblems);

// ══════════════════════════════════════════════════════════
// CATEGORY MANAGEMENT
// ══════════════════════════════════════════════════════════
router.post('/categories', AdminController.createCategory);
router.put('/categories/:id', AdminController.updateCategory);
router.delete('/categories/:id', AdminController.deleteCategory);

// ══════════════════════════════════════════════════════════
// PATTERN MANAGEMENT
// ══════════════════════════════════════════════════════════
router.post('/patterns', AdminController.createPattern);
router.put('/patterns/:id', AdminController.updatePattern);
router.delete('/patterns/:id', AdminController.deletePattern);
router.post('/patterns/link', AdminController.linkProblemPattern);
router.post('/patterns/unlink', AdminController.unlinkProblemPattern);

// ══════════════════════════════════════════════════════════
// ROADMAP MANAGEMENT
// ══════════════════════════════════════════════════════════
router.get('/roadmaps', AdminController.listRoadmaps);
router.post('/roadmaps', AdminController.createRoadmap);
router.put('/roadmaps/:id', AdminController.updateRoadmap);
router.delete('/roadmaps/:id', AdminController.deleteRoadmap);
router.post('/roadmaps/:id/items', AdminController.addRoadmapItem);
router.delete('/roadmaps/:id/items/:itemId', AdminController.removeRoadmapItem);
router.put('/roadmaps/:id/reorder', AdminController.reorderRoadmapItems);

// ══════════════════════════════════════════════════════════
// PLANS MANAGEMENT (Dynamic)
// ══════════════════════════════════════════════════════════
router.get('/plans', AdminController.listPlans);
router.post('/plans', requireSuperAdmin, AdminController.createPlan);
router.put('/plans/:id', requireSuperAdmin, AdminController.updatePlan);
router.delete('/plans/:id', requireSuperAdmin, AdminController.deletePlan);

// ══════════════════════════════════════════════════════════
// SYSTEM SETTINGS
// ══════════════════════════════════════════════════════════
router.get('/settings', AdminController.getSettings);
router.put('/settings', requireSuperAdmin, AdminController.updateSettings);

// ══════════════════════════════════════════════════════════
// REFERRAL MANAGEMENT (Enhanced)
// ══════════════════════════════════════════════════════════
router.get('/referrals/stats', AdminController.getReferralStats);
router.get('/referrals/all', AdminController.listAllReferrals);
router.get('/referrals/flagged', AdminController.getFlaggedReferrals);
router.put('/referrals/:id/verify', AdminController.verifyReferral);
router.put('/referrals/:id/reject', AdminController.rejectReferral);

// ══════════════════════════════════════════════════════════
// FEEDBACK MANAGEMENT
// ══════════════════════════════════════════════════════════
router.get('/feedback', AdminController.listFeedback);
router.put('/feedback/:id', AdminController.updateFeedbackStatus);

// ══════════════════════════════════════════════════════════
// TASK ASSIGNMENT
// ══════════════════════════════════════════════════════════
router.post('/tasks/assign/:userId', AdminController.assignTaskToUser);
router.post('/tasks/assign-all', AdminController.assignTaskToAll);

// ══════════════════════════════════════════════════════════
// LEADERBOARD MANAGEMENT
// ══════════════════════════════════════════════════════════
router.get('/leaderboard/config', AdminController.getLeaderboardConfig);
router.put('/leaderboard/config', AdminController.updateLeaderboardConfig);

// ══════════════════════════════════════════════════════════
// AI CONFIGURATION
// ══════════════════════════════════════════════════════════
router.get('/ai/config', AdminController.getAIConfig);
router.put('/ai/config', requireSuperAdmin, AdminController.updateAIConfig);

// ══════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════
router.get('/logs', AdminController.getAuditLogs);

// ══════════════════════════════════════════════════════════
// WITHDRAWALS
// ══════════════════════════════════════════════════════════
router.get('/withdrawals', AdminController.getWithdrawals);
router.post('/withdrawals/:id/process', AdminController.processWithdrawal);

export default router;
