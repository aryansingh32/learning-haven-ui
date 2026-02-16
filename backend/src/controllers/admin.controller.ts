import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AdminService } from '../services/admin.service';
import { CategoriesService } from '../services/categories.service';
import { RoadmapsService } from '../services/roadmaps.service';
import { TasksService } from '../services/tasks.service';
import { FeedbackService } from '../services/feedback.service';
import { supabase } from '../config/database';
import logger from '../config/logger';

export class AdminController {
    // ══════════════════════════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════════════════════════

    static async getDashboard(req: Request, res: Response) {
        try {
            const stats = await AdminService.getDashboardStats();
            res.json(stats);
        } catch (error) {
            logger.error('Admin dashboard error:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // USER MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async listUsers(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const search = req.query.search as string | undefined;
            const plan = req.query.plan as string | undefined;
            const result = await AdminService.listUsers(page, limit, search, plan);
            res.json(result);
        } catch (error) {
            logger.error('Admin list users error:', error);
            res.status(500).json({ error: 'Failed to list users' });
        }
    }

    static async getUserDetail(req: Request, res: Response) {
        try {
            const userId = req.params.id as string;
            const detail = await AdminService.getUserDetail(userId);
            res.json(detail);
        } catch (error) {
            logger.error('Admin user detail error:', error);
            res.status(500).json({ error: 'Failed to fetch user details' });
        }
    }

    static async updateUserRole(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const targetId = req.params.id as string;
            const { role } = req.body;
            const result = await AdminService.updateUserRole(adminId, targetId, role);
            res.json(result);
        } catch (error: any) {
            logger.error('Update role error:', error);
            if (error.message === 'Invalid role') return res.status(400).json({ error: error.message });
            res.status(500).json({ error: 'Failed to update user role' });
        }
    }

    static async toggleUserBan(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const targetId = req.params.id as string;
            const { banned } = req.body;
            const result = await AdminService.toggleUserBan(adminId, targetId, banned);
            res.json(result);
        } catch (error) {
            logger.error('Toggle ban error:', error);
            res.status(500).json({ error: 'Failed to update user ban' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // PROBLEM MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async createProblem(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const result = await AdminService.upsertProblem(adminId, req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error('Create problem error:', error);
            res.status(500).json({ error: 'Failed to create problem' });
        }
    }

    static async updateProblem(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const problemId = req.params.id as string;
            const result = await AdminService.upsertProblem(adminId, { ...req.body, id: problemId });
            res.json(result);
        } catch (error) {
            logger.error('Update problem error:', error);
            res.status(500).json({ error: 'Failed to update problem' });
        }
    }

    static async deleteProblem(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const problemId = req.params.id as string;
            const result = await AdminService.deleteProblem(adminId, problemId);
            res.json(result);
        } catch (error) {
            logger.error('Delete problem error:', error);
            res.status(500).json({ error: 'Failed to delete problem' });
        }
    }

    /**
     * POST /api/admin/problems/import — Bulk import from Google Sheets/CSV
     */
    static async importProblems(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            let problems = req.body.problems;
            const sheetUrl = req.body.sheet_url;

            if (sheetUrl) {
                const { GoogleSheetsService } = await import('../services/googleSheets.service');
                problems = await GoogleSheetsService.fetchCsvData(sheetUrl);
            }

            if (!Array.isArray(problems) || problems.length === 0) {
                return res.status(400).json({ error: 'problems array or valid sheet_url is required' });
            }
            const result = await CategoriesService.importProblems(adminId, problems);
            res.json(result);
        } catch (error: any) {
            logger.error('Import problems error:', error);
            res.status(500).json({ error: error.message || 'Failed to import problems' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // CATEGORY MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async createCategory(req: Request, res: Response) {
        try {
            const result = await CategoriesService.createCategory(req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error('Create category error:', error);
            res.status(500).json({ error: 'Failed to create category' });
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const result = await CategoriesService.updateCategory(req.params.id as string, req.body);
            res.json(result);
        } catch (error) {
            logger.error('Update category error:', error);
            res.status(500).json({ error: 'Failed to update category' });
        }
    }

    static async deleteCategory(req: Request, res: Response) {
        try {
            const result = await CategoriesService.deleteCategory(req.params.id as string);
            res.json(result);
        } catch (error) {
            logger.error('Delete category error:', error);
            res.status(500).json({ error: 'Failed to delete category' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // PATTERN MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async createPattern(req: Request, res: Response) {
        try {
            const result = await CategoriesService.createPattern(req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error('Create pattern error:', error);
            res.status(500).json({ error: 'Failed to create pattern' });
        }
    }

    static async updatePattern(req: Request, res: Response) {
        try {
            const result = await CategoriesService.updatePattern(req.params.id as string, req.body);
            res.json(result);
        } catch (error) {
            logger.error('Update pattern error:', error);
            res.status(500).json({ error: 'Failed to update pattern' });
        }
    }

    static async deletePattern(req: Request, res: Response) {
        try {
            const result = await CategoriesService.deletePattern(req.params.id as string);
            res.json(result);
        } catch (error) {
            logger.error('Delete pattern error:', error);
            res.status(500).json({ error: 'Failed to delete pattern' });
        }
    }

    static async linkProblemPattern(req: Request, res: Response) {
        try {
            const { problem_id, pattern_id, is_primary } = req.body;
            const result = await CategoriesService.linkProblemToPattern(problem_id, pattern_id, is_primary);
            res.json(result);
        } catch (error) {
            logger.error('Link problem-pattern error:', error);
            res.status(500).json({ error: 'Failed to link problem to pattern' });
        }
    }

    static async unlinkProblemPattern(req: Request, res: Response) {
        try {
            const { problem_id, pattern_id } = req.body;
            const result = await CategoriesService.unlinkProblemFromPattern(problem_id, pattern_id);
            res.json(result);
        } catch (error) {
            logger.error('Unlink problem-pattern error:', error);
            res.status(500).json({ error: 'Failed to unlink problem from pattern' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // ROADMAP MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async listRoadmaps(req: Request, res: Response) {
        try {
            const roadmaps = await RoadmapsService.listRoadmaps(true); // include unpublished
            res.json(roadmaps);
        } catch (error) {
            logger.error('Admin list roadmaps error:', error);
            res.status(500).json({ error: 'Failed to list roadmaps' });
        }
    }

    static async createRoadmap(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const result = await RoadmapsService.createRoadmap(adminId, req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error('Create roadmap error:', error);
            res.status(500).json({ error: 'Failed to create roadmap' });
        }
    }

    static async updateRoadmap(req: Request, res: Response) {
        try {
            const result = await RoadmapsService.updateRoadmap(req.params.id as string, req.body);
            res.json(result);
        } catch (error) {
            logger.error('Update roadmap error:', error);
            res.status(500).json({ error: 'Failed to update roadmap' });
        }
    }

    static async deleteRoadmap(req: Request, res: Response) {
        try {
            const result = await RoadmapsService.deleteRoadmap(req.params.id as string);
            res.json(result);
        } catch (error) {
            logger.error('Delete roadmap error:', error);
            res.status(500).json({ error: 'Failed to delete roadmap' });
        }
    }

    static async addRoadmapItem(req: Request, res: Response) {
        try {
            const result = await RoadmapsService.addRoadmapItem(req.params.id as string, req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error('Add roadmap item error:', error);
            res.status(500).json({ error: 'Failed to add roadmap item' });
        }
    }

    static async removeRoadmapItem(req: Request, res: Response) {
        try {
            const result = await RoadmapsService.removeRoadmapItem(req.params.id as string, req.params.itemId as string);
            res.json(result);
        } catch (error) {
            logger.error('Remove roadmap item error:', error);
            res.status(500).json({ error: 'Failed to remove roadmap item' });
        }
    }

    static async reorderRoadmapItems(req: Request, res: Response) {
        try {
            const { items } = req.body;
            const result = await RoadmapsService.reorderItems(req.params.id as string, items);
            res.json(result);
        } catch (error) {
            logger.error('Reorder roadmap items error:', error);
            res.status(500).json({ error: 'Failed to reorder items' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // PLANS MANAGEMENT (Dynamic)
    // ══════════════════════════════════════════════════════════

    static async listPlans(req: Request, res: Response) {
        try {
            const { data, error } = await supabase
                .from('plans_config')
                .select('*')
                .order('order_index', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } catch (error) {
            logger.error('List plans error:', error);
            res.status(500).json({ error: 'Failed to list plans' });
        }
    }

    static async createPlan(req: Request, res: Response) {
        try {
            const { data, error } = await supabase
                .from('plans_config')
                .insert(req.body)
                .select()
                .single();

            if (error) throw error;
            res.status(201).json(data);
        } catch (error) {
            logger.error('Create plan error:', error);
            res.status(500).json({ error: 'Failed to create plan' });
        }
    }

    static async updatePlan(req: Request, res: Response) {
        try {
            const { data, error } = await supabase
                .from('plans_config')
                .update(req.body)
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            logger.error('Update plan error:', error);
            res.status(500).json({ error: 'Failed to update plan' });
        }
    }

    static async deletePlan(req: Request, res: Response) {
        try {
            const { error } = await supabase.from('plans_config').delete().eq('id', req.params.id);
            if (error) throw error;
            res.json({ message: 'Plan deleted' });
        } catch (error) {
            logger.error('Delete plan error:', error);
            res.status(500).json({ error: 'Failed to delete plan' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // SYSTEM SETTINGS
    // ══════════════════════════════════════════════════════════

    static async getSettings(req: Request, res: Response) {
        try {
            const category = req.query.category as string | undefined;
            let query = supabase.from('system_settings').select('*');
            if (category) query = query.eq('category', category);

            const { data, error } = await query;
            if (error) throw error;

            // Transform to key-value map
            const settings: Record<string, any> = {};
            (data || []).forEach((s: any) => {
                settings[s.key] = { value: s.value, description: s.description, category: s.category };
            });
            res.json(settings);
        } catch (error) {
            logger.error('Get settings error:', error);
            res.status(500).json({ error: 'Failed to get settings' });
        }
    }

    static async updateSettings(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const updates = req.body; // { key: value, key: value }

            for (const [key, value] of Object.entries(updates)) {
                await supabase
                    .from('system_settings')
                    .upsert({
                        key,
                        value: JSON.stringify(value),
                        updated_by: adminId,
                        updated_at: new Date().toISOString(),
                    });
            }

            res.json({ message: 'Settings updated', updated: Object.keys(updates).length });
        } catch (error) {
            logger.error('Update settings error:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // REFERRAL MANAGEMENT (Enhanced)
    // ══════════════════════════════════════════════════════════

    static async getReferralStats(req: Request, res: Response) {
        try {
            const { data: referrals, error } = await supabase
                .from('referrals')
                .select('status, earned_amount, paid_amount');

            if (error) throw error;

            const stats = {
                total: referrals?.length || 0,
                pending: referrals?.filter(r => r.status === 'pending').length || 0,
                active: referrals?.filter(r => r.status === 'active').length || 0,
                paid: referrals?.filter(r => r.status === 'paid').length || 0,
                rejected: referrals?.filter(r => r.status === 'rejected').length || 0,
                total_earned: referrals?.reduce((sum, r) => sum + (r.earned_amount || 0), 0) || 0,
                total_paid: referrals?.reduce((sum, r) => sum + (r.paid_amount || 0), 0) || 0,
            };
            res.json(stats);
        } catch (error) {
            logger.error('Referral stats error:', error);
            res.status(500).json({ error: 'Failed to get referral stats' });
        }
    }

    static async listAllReferrals(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const status = req.query.status as string | undefined;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('referrals')
                .select('*, referrer:referrer_id(email, full_name), referred:referred_user_id(email, full_name)', { count: 'exact' });

            if (status) query = query.eq('status', status);
            query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            res.json({
                referrals: data || [],
                pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
            });
        } catch (error) {
            logger.error('List all referrals error:', error);
            res.status(500).json({ error: 'Failed to list referrals' });
        }
    }

    static async verifyReferral(req: Request, res: Response) {
        try {
            const { data, error } = await supabase
                .from('referrals')
                .update({ status: 'active', is_suspicious: false })
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            logger.error('Verify referral error:', error);
            res.status(500).json({ error: 'Failed to verify referral' });
        }
    }

    static async rejectReferral(req: Request, res: Response) {
        try {
            const { data, error } = await supabase
                .from('referrals')
                .update({ status: 'rejected' })
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error) {
            logger.error('Reject referral error:', error);
            res.status(500).json({ error: 'Failed to reject referral' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // ANALYTICS REPORTS
    // ══════════════════════════════════════════════════════════

    static async getAnalyticsReport(req: Request, res: Response) {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

            // Active users
            const { count: dauCount } = await supabase
                .from('submissions')
                .select('user_id', { count: 'exact', head: true })
                .gte('submitted_at', todayStart);

            const { count: mauCount } = await supabase
                .from('submissions')
                .select('user_id', { count: 'exact', head: true })
                .gte('submitted_at', thirtyDaysAgo);

            // Revenue
            const { data: recentPayments } = await supabase
                .from('payments')
                .select('amount, created_at')
                .eq('status', 'captured')
                .gte('created_at', thirtyDaysAgo);

            const revenue30d = recentPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

            // Growth
            const { count: newUsers7d } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', sevenDaysAgo);

            const { count: totalUsers } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true });

            // Submissions
            const { count: submissions7d } = await supabase
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .gte('submitted_at', sevenDaysAgo);

            res.json({
                active_users: { dau: dauCount || 0, mau: mauCount || 0 },
                revenue: { last_30_days: revenue30d, currency: 'INR' },
                growth: { new_users_7d: newUsers7d || 0, total_users: totalUsers || 0 },
                engagement: { submissions_7d: submissions7d || 0 },
            });
        } catch (error) {
            logger.error('Analytics report error:', error);
            res.status(500).json({ error: 'Failed to get analytics report' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // FEEDBACK MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async listFeedback(req: Request, res: Response) {
        try {
            const result = await FeedbackService.listAllFeedback({
                status: req.query.status as string | undefined,
                type: req.query.type as string | undefined,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20,
            });
            res.json(result);
        } catch (error) {
            logger.error('List feedback error:', error);
            res.status(500).json({ error: 'Failed to list feedback' });
        }
    }

    static async updateFeedbackStatus(req: Request, res: Response) {
        try {
            const result = await FeedbackService.updateFeedback(req.params.id as string, req.body);
            res.json(result);
        } catch (error) {
            logger.error('Update feedback error:', error);
            res.status(500).json({ error: 'Failed to update feedback' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // TASK ASSIGNMENT
    // ══════════════════════════════════════════════════════════

    static async assignTaskToUser(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const targetUserId = req.params.userId as string;
            const task = await TasksService.assignTask(adminId, targetUserId, req.body);
            res.status(201).json(task);
        } catch (error) {
            logger.error('Assign task error:', error);
            res.status(500).json({ error: 'Failed to assign task' });
        }
    }

    static async assignTaskToAll(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const result = await TasksService.assignTaskToAll(adminId, req.body);
            res.json(result);
        } catch (error) {
            logger.error('Assign task to all error:', error);
            res.status(500).json({ error: 'Failed to assign tasks' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // LEADERBOARD MANAGEMENT
    // ══════════════════════════════════════════════════════════

    static async getLeaderboardConfig(req: Request, res: Response) {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'leaderboard_visible_count')
                .single();

            res.json({ visible_count: data?.value || 100 });
        } catch (error) {
            logger.error('Leaderboard config error:', error);
            res.status(500).json({ error: 'Failed to get leaderboard config' });
        }
    }

    static async updateLeaderboardConfig(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const { visible_count } = req.body;

            await supabase
                .from('system_settings')
                .upsert({
                    key: 'leaderboard_visible_count',
                    value: JSON.stringify(visible_count),
                    updated_by: adminId,
                });

            res.json({ message: 'Leaderboard config updated' });
        } catch (error) {
            logger.error('Update leaderboard config error:', error);
            res.status(500).json({ error: 'Failed to update leaderboard config' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // AI CONFIGURATION
    // ══════════════════════════════════════════════════════════

    static async getAIConfig(req: Request, res: Response) {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('key, value, description')
                .eq('category', 'ai');

            const config: Record<string, any> = {};
            (data || []).forEach((s: any) => { config[s.key] = s.value; });
            res.json(config);
        } catch (error) {
            logger.error('Get AI config error:', error);
            res.status(500).json({ error: 'Failed to get AI config' });
        }
    }

    static async updateAIConfig(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const updates = req.body; // { ai_model: "gpt-4", ai_temperature: 0.5, ... }

            for (const [key, value] of Object.entries(updates)) {
                await supabase
                    .from('system_settings')
                    .upsert({
                        key,
                        value: JSON.stringify(value),
                        category: 'ai',
                        updated_by: adminId,
                    });
            }

            res.json({ message: 'AI config updated' });
        } catch (error) {
            logger.error('Update AI config error:', error);
            res.status(500).json({ error: 'Failed to update AI config' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // AUDIT LOGS (existing)
    // ══════════════════════════════════════════════════════════

    static async getAuditLogs(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const action = req.query.action as string | undefined;
            const result = await AdminService.getAuditLogs(page, limit, action);
            res.json(result);
        } catch (error) {
            logger.error('Audit logs error:', error);
            res.status(500).json({ error: 'Failed to fetch audit logs' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // WITHDRAWALS (existing)
    // ══════════════════════════════════════════════════════════

    static async getWithdrawals(req: Request, res: Response) {
        try {
            const status = (req.query.status as string) || 'pending';
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const result = await AdminService.getWithdrawals(status, page, limit);
            res.json(result);
        } catch (error) {
            logger.error('Admin withdrawals error:', error);
            res.status(500).json({ error: 'Failed to fetch withdrawals' });
        }
    }

    static async processWithdrawal(req: Request, res: Response) {
        try {
            const adminId = (req as AuthRequest).user!.id;
            const withdrawalId = req.params.id as string;
            const { action } = req.body;
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ error: 'Action must be approve or reject' });
            }
            const result = await AdminService.processWithdrawal(adminId, withdrawalId, action);
            res.json(result);
        } catch (error: any) {
            logger.error('Process withdrawal error:', error);
            const known = ['Withdrawal not found', 'Withdrawal already processed'];
            if (known.includes(error.message)) return res.status(400).json({ error: error.message });
            res.status(500).json({ error: 'Failed to process withdrawal' });
        }
    }

    // ══════════════════════════════════════════════════════════
    // FLAGGED REFERRALS (existing)
    // ══════════════════════════════════════════════════════════

    static async getFlaggedReferrals(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const result = await AdminService.getFlaggedReferrals(page, limit);
            res.json(result);
        } catch (error) {
            logger.error('Flagged referrals error:', error);
            res.status(500).json({ error: 'Failed to fetch flagged referrals' });
        }
    }
}
