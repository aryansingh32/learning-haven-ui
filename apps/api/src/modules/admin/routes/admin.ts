import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateUser } from '../../../middleware/auth';
import { requireAdmin, requireSuperAdmin } from '../../../middleware/requireAdmin';
import { adminLogging } from '../../../middleware/adminLogging';
import { AdminPermissionsController } from '../controllers/admin.permissions.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateUser, requireAdmin, adminLogging);

// ══════════════════════════════════════════════════════════
// DASHBOARD & HEALTH
// ══════════════════════════════════════════════════════════
router.get('/dashboard', AdminController.getDashboard);
router.get('/health', requireSuperAdmin, AdminController.getSystemHealth);

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
// COURSE MANAGEMENT
// ══════════════════════════════════════════════════════════
router.get('/courses', AdminController.listCourses);
router.post('/courses', AdminController.createCourse);
router.put('/courses/reorder', AdminController.reorderCourses);
router.put('/courses/:id', AdminController.updateCourse);
router.delete('/courses/:id', AdminController.deleteCourse);
router.post('/courses/:id/items', AdminController.addCourseItem);
router.delete('/courses/:id/items/:itemId', AdminController.removeCourseItem);
router.put('/courses/:id/reorder', AdminController.reorderCourseItems);

// ══════════════════════════════════════════════════════════
// CHAPTER MANAGEMENT (Learn)
// ══════════════════════════════════════════════════════════
router.get('/chapters', AdminController.listChapters);
router.get('/chapters/:id', AdminController.getChapter);
router.post('/chapters', AdminController.createChapter);
router.put('/chapters/:id', AdminController.updateChapter);
router.delete('/chapters/:id', AdminController.deleteChapter);
router.put('/chapters/:id/content', AdminController.upsertChapterContent);
router.put('/chapters/:id/steps', AdminController.replaceChapterSteps);
router.put('/chapters/:id/progress', AdminController.setUserChapterProgress);

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

import { getCustomReferrals, createCustomReferral, updateCustomReferral } from '../controllers/admin.referrals.controller';
import * as AdminCommerceController from '../controllers/admin.commerce.controller';

// ══════════════════════════════════════════════════════════
// REFERRAL MANAGEMENT (Enhanced)
// ══════════════════════════════════════════════════════════
router.get('/referrals/stats', AdminController.getReferralStats);
router.get('/referrals/all', AdminController.listAllReferrals);
router.get('/referrals/flagged', AdminController.getFlaggedReferrals);
router.put('/referrals/:id/verify', AdminController.verifyReferral);
router.put('/referrals/:id/reject', AdminController.rejectReferral);

// Custom Referrals
router.get('/referrals/custom', getCustomReferrals);
router.post('/referrals/custom', createCustomReferral);
router.put('/referrals/custom/:id', updateCustomReferral);

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
router.put('/ai/config', requireAdmin, AdminController.updateAIConfig);

// ══════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════
router.get('/logs', AdminController.getAuditLogs);

// ══════════════════════════════════════════════════════════
// WITHDRAWALS
// ══════════════════════════════════════════════════════════
router.get('/withdrawals', AdminController.getWithdrawals);
router.post('/withdrawals/:id/process', AdminController.processWithdrawal);

// ══════════════════════════════════════════════════════════
// JOBS
// ══════════════════════════════════════════════════════════
router.post('/jobs', AdminController.createJob);
router.put('/jobs/:id', AdminController.updateJob);

// ══════════════════════════════════════════════════════════
// COMMERCE V2 (Plans, Coupons, Referrals, Withdrawals)
// ══════════════════════════════════════════════════════════
import adminCommerceV2Routes from './admin-commerce.v2';
router.use('/commerce/v2', adminCommerceV2Routes);

// ══════════════════════════════════════════════════════════
// ROLES & PERMISSIONS
// ══════════════════════════════════════════════════════════
router.get('/roles', requireSuperAdmin, AdminPermissionsController.getRoles);
router.post('/roles', requireSuperAdmin, AdminPermissionsController.createRole);
router.get('/roles/:roleId/permissions', requireSuperAdmin, AdminPermissionsController.getRolePermissions);
router.put('/roles/:roleId/permissions', requireSuperAdmin, AdminPermissionsController.updateRolePermissions);

export default router;

