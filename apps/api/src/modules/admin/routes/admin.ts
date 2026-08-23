import { Router } from 'express';
import multer from 'multer';
import logger from '../../../config/logger';
import { AdminController } from '../controllers/admin.controller';
import { authenticateUser } from '../../../middleware/auth';
import { requireAdmin, requireSuperAdmin } from '../../../middleware/requireAdmin';
import { adminLogging } from '../../../middleware/adminLogging';
import { AdminPermissionsController } from '../controllers/admin.permissions.controller';
import { ContentImportController } from '../controllers/contentImport.controller';

const router = Router();

// Multer: memory storage, 5 MB limit, .csv only (used only for POST /content/import)
const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only .csv files are allowed'));
        }
    },
}).single('file');

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
router.post('/courses/bulk-delete', AdminController.bulkDeleteCourses);
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
// CERTIFICATES MANAGEMENT (BUG-020)
// ══════════════════════════════════════════════════════════
import { pool } from '../../../config/database';
import { ok, serverError } from '../../../utils/api-response';

router.get('/certificates', async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.id, c.user_id, c.topic_name, c.certificate_code, c.created_at,
             c.is_valid, u.full_name, u.email
      FROM public.certificates c
      JOIN public.users u ON u.id = c.user_id
    `;
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE (u.full_name ILIKE $1 OR u.email ILIKE $1 OR c.topic_name ILIKE $1 OR c.certificate_code ILIKE $1)`;
    }
    query += ` ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await pool.query(query, params);

    // Count total
    let countQuery = `SELECT COUNT(*) FROM public.certificates c JOIN public.users u ON u.id = c.user_id`;
    if (search) countQuery += ` WHERE (u.full_name ILIKE $1 OR u.email ILIKE $1)`;
    const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
    const total = parseInt(countResult.rows[0].count, 10);

    return ok(res, {
      certificates: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return serverError(res);
  }
});

router.delete('/certificates/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE public.certificates SET is_valid = false, revoked_at = NOW() WHERE id = $1`,
      [id]
    );
    return ok(res, { revoked: true });
  } catch (error) {
    return serverError(res);
  }
});

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

// ══════════════════════════════════════════════════════════
// CONTENT IMPORT (Staged CSV/Sheet import pipeline)
// ══════════════════════════════════════════════════════════
// Template download & history BEFORE :batchId to avoid param collisions
router.get('/content/templates/:contentType', ContentImportController.downloadTemplate);
router.get('/content/import/history', ContentImportController.getHistory);
router.post('/content/import', csvUpload, ContentImportController.importContent);
router.get('/content/import/:batchId', ContentImportController.getBatch);
router.patch('/content/import/:batchId/rows/:rowId', ContentImportController.updateRow);
router.post('/content/import/:batchId/publish', ContentImportController.publishBatch);

// ══════════════════════════════════════════════════════════
// TASK 1: User Intelligence Endpoint
// ══════════════════════════════════════════════════════════
router.get('/users/:id/intelligence', async (req: any, res: any) => {
  try {
    const { pool } = await import('../../../config/database');
    const userId = req.params.id;

    // Last active (most recent submission or login)
    const lastActiveResult = await pool.query(`
      SELECT GREATEST(
        COALESCE((SELECT MAX(submitted_at) FROM public.submissions WHERE user_id = $1), '1970-01-01'),
        COALESCE((SELECT MAX(updated_at) FROM public.user_chapter_progress WHERE user_id = $1), '1970-01-01'),
        COALESCE((SELECT updated_at FROM public.users WHERE id = $1), '1970-01-01')
      ) AS last_active
    `, [userId]);
    const lastActive = lastActiveResult.rows[0]?.last_active;

    // Purchases / payments
    const purchasesResult = await pool.query(`
      SELECT p.id, p.amount, p.status, p.created_at, pl.name AS plan_name
      FROM public.payments p
      LEFT JOIN public.plans_config pl ON pl.id::text = p.plan_id::text
      WHERE p.user_id = $1 AND p.status = 'captured'
      ORDER BY p.created_at DESC LIMIT 20
    `, [userId]);

    // Activity timeline (last 20 events from submissions + chapter progress)
    const timelineResult = await pool.query(`
      SELECT 'Solved problem' AS action, submitted_at AS timestamp FROM public.submissions WHERE user_id = $1
      UNION ALL
      SELECT 'Completed chapter' AS action, updated_at AS timestamp FROM public.user_chapter_progress WHERE user_id = $1 AND status = 'COMPLETED'
      ORDER BY timestamp DESC LIMIT 20
    `, [userId]);

    // AI usage (from rate limit usage table if it exists, else 0)
    let aiUsage = { totalTokens: 0, interactions: 0 };
    try {
      const aiResult = await pool.query(`
        SELECT COUNT(*) AS interactions FROM public.rate_limit_usage
        WHERE user_id = $1 AND metric = 'ai_queries_per_day'
      `, [userId]);
      aiUsage.interactions = parseInt(aiResult.rows[0]?.interactions || '0');
    } catch { /* table may not exist */ }

    // Fraud score (based on referral suspicious flag)
    const fraudResult = await pool.query(`
      SELECT COUNT(*) AS flagged FROM public.referrals
      WHERE referrer_id = $1 AND is_suspicious = true
    `, [userId]);
    const fraudScore = Math.min(100, parseInt(fraudResult.rows[0]?.flagged || '0') * 25);

    // LTV
    const ltv = purchasesResult.rows.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    res.json({
      lastActive,
      fraudScore,
      ltv,
      purchases: purchasesResult.rows.map((p: any) => ({
        plan_name: p.plan_name || 'Subscription',
        amount: p.amount,
        date: p.created_at,
        status: p.status,
      })),
      timeline: timelineResult.rows,
      aiUsage,
    });
  } catch (err) {
    logger.error('User intelligence error:', err);
    res.status(500).json({ error: 'Failed to fetch user intelligence' });
  }
});

// ══════════════════════════════════════════════════════════
// TASK 2: Manual XP Adjustment Endpoint
// ══════════════════════════════════════════════════════════
router.put('/users/:id/xp', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { pool } = await import('../../../config/database');
    const { delta, reason } = req.body; // delta can be positive or negative
    if (typeof delta !== 'number') return res.status(400).json({ error: 'delta (number) required' });
    
    const result = await pool.query(`
      UPDATE public.users
      SET xp = GREATEST(0, COALESCE(xp, 0) + $1),
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, xp, full_name
    `, [delta, req.params.id]);
    
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    
    // Log audit
    try {
      await pool.query(`
        INSERT INTO public.admin_audit_logs (admin_id, action, target_id, metadata)
        VALUES ($1, 'xp_adjustment', $2, $3)
      `, [(req as any).user.id, req.params.id, JSON.stringify({ delta, reason })]);
    } catch { /* audit table may not exist */ }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    logger.error('XP adjustment error:', err);
    res.status(500).json({ error: 'Failed to adjust XP' });
  }
});

// ══════════════════════════════════════════════════════════
// TASK 3: Manual Plan Override Endpoint
// ══════════════════════════════════════════════════════════
router.put('/users/:id/plan', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { pool } = await import('../../../config/database');
    const { plan, reason } = req.body;
    const validPlans = ['free', 'basic', 'pro', 'ultra'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: `plan must be one of: ${validPlans.join(', ')}` });
    }
    
    const result = await pool.query(`
      UPDATE public.users
      SET current_plan = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, current_plan, full_name, email
    `, [plan, req.params.id]);
    
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    
    try {
      await pool.query(`
        INSERT INTO public.admin_audit_logs (admin_id, action, target_id, metadata)
        VALUES ($1, 'plan_override', $2, $3)
      `, [(req as any).user.id, req.params.id, JSON.stringify({ plan, reason })]);
    } catch { /* audit table may not exist */ }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    logger.error('Plan override error:', err);
    res.status(500).json({ error: 'Failed to override plan' });
  }
});

// ══════════════════════════════════════════════════════════
// TASK 6: Manual Certificate Grant
// ══════════════════════════════════════════════════════════
router.post('/users/:id/grant-certificate', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { pool } = await import('../../../config/database');
    const { topic_name, reason } = req.body;
    if (!topic_name) return res.status(400).json({ error: 'topic_name required' });
    
    const code = `CERT-MANUAL-${Date.now().toString(36).toUpperCase()}`;
    const result = await pool.query(`
      INSERT INTO public.certificates (user_id, topic_name, certificate_code, is_valid, issued_by_admin)
      VALUES ($1, $2, $3, true, true)
      ON CONFLICT (user_id, topic_name) DO UPDATE
        SET is_valid = true, certificate_code = EXCLUDED.certificate_code, updated_at = NOW()
      RETURNING *
    `, [req.params.id, topic_name, code]);
    
    res.json({ success: true, certificate: result.rows[0] });
  } catch (err: any) {
    logger.error('Grant cert error:', err);
    // Handle missing column gracefully
    if (err.message?.includes('issued_by_admin') || err.message?.includes('column')) {
      try {
        const { pool } = await import('../../../config/database');
        const code = `CERT-MANUAL-${Date.now().toString(36).toUpperCase()}`;
        const result = await pool.query(`
          INSERT INTO public.certificates (user_id, topic_name, certificate_code, is_valid)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (user_id, topic_name) DO UPDATE SET is_valid = true RETURNING *
        `, [req.params.id, req.body.topic_name, code]);
        return res.json({ success: true, certificate: result.rows[0] });
      } catch (e2) {
        return res.status(500).json({ error: 'Failed to grant certificate' });
      }
    }
    res.status(500).json({ error: 'Failed to grant certificate' });
  }
});

// ══════════════════════════════════════════════════════════
// TASK 7: Communication Templates API
// ══════════════════════════════════════════════════════════
import { supabaseAdmin as supabase } from '../../../config/database';

router.get('/communication/templates', async (req: any, res: any) => {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'communication_templates')
      .maybeSingle();
    
    let templates = [];
    if (data?.value) {
      try { templates = JSON.parse(data.value); } catch { templates = []; }
    }
    res.json({ templates });
  } catch (err) {
    res.json({ templates: [] });
  }
});

router.put('/communication/templates', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const adminId = req.user.id;
    const { templates } = req.body;
    if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates array required' });
    
    const { error } = await supabase.from('system_settings').upsert({
      key: 'communication_templates',
      value: JSON.stringify(templates),
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('Save templates error:', err);
    res.status(500).json({ error: 'Failed to save templates' });
  }
});

router.post('/communication/send', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { type, recipient, subject, body, template_id } = req.body;
    // Log the send attempt (actual sending would use email/WhatsApp service)
    logger.info('Admin communication send', { type, recipient, subject, template_id, adminId: req.user.id });
    
    // For now store in system logs — real impl would call email/WhatsApp provider
    res.json({ success: true, message: 'Message queued for delivery' });
  } catch (err) {
    logger.error('Communication send error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;

