import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import { UsersService } from './users.service';
import logger from '../config/logger';


export class AdminService {
    /**
     * Dashboard overview stats
     */
    static async getDashboardStats() {
        try {
            const cached = await CacheService.get<any>('admin:dashboard');
            if (cached) return cached;

            // Run all counts in parallel
            const [usersRes, subsRes, paymentsRes, problemsRes, submissionsRes, referralsRes] = await Promise.all([
                supabase.from('users').select('id', { count: 'exact', head: true }),
                supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('payments').select('amount').eq('status', 'captured'),
                supabase.from('problems').select('id', { count: 'exact', head: true }),
                supabase.from('submissions').select('id', { count: 'exact', head: true }),
                supabase.from('referrals').select('id', { count: 'exact', head: true }).in('status', ['active', 'paid']),
            ]);

            // Calculate total revenue
            const totalRevenue = paymentsRes.data?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

            // Recent signups (last 7 days)
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { count: recentSignups } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', weekAgo);

            // Today's signups
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { count: todaySignups } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', todayStart.toISOString());

            const stats = {
                users: {
                    total: usersRes.count || 0,
                    recent_7d: recentSignups || 0,
                    today: todaySignups || 0,
                },
                subscriptions: {
                    active: subsRes.count || 0,
                },
                revenue: {
                    total: totalRevenue,
                    total_display: `₹${(totalRevenue / 100).toLocaleString('en-IN')}`,
                },
                problems: {
                    total: problemsRes.count || 0,
                },
                submissions: {
                    total: submissionsRes.count || 0,
                },
                referrals: {
                    activated: referralsRes.count || 0,
                },
            };

            await CacheService.set('admin:dashboard', stats, 120); // 2 min cache
            return stats;
        } catch (error) {
            logger.error('Dashboard stats error:', error);
            throw new Error('Failed to fetch dashboard stats');
        }
    }

    /**
     * List users with filtering and pagination
     */
    static async listUsers(page: number = 1, limit: number = 20, search?: string, plan?: string) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('users')
                .select('id, email, full_name, current_plan, role, xp, streak, created_at, last_active_date', { count: 'exact' });

            if (search) {
                query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
            }

            if (plan && plan !== 'all') {
                query = query.eq('current_plan', plan);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return {
                users: data || [],
                total: count || 0,
                page,
                total_pages: Math.ceil((count || 0) / limit),
            };
        } catch (error) {
            logger.error('List users error:', error);
            throw new Error('Failed to list users');
        }
    }

    /**
     * Get detailed user info (admin view)
     */
    static async getUserDetail(userId: string) {
        try {
            const [userRes, subsRes, paymentsRes, submissionsRes, referralsRes, activityRes, radarRes, weeklyRes] = await Promise.all([
                supabase.from('users').select('*').eq('id', userId).single(),
                supabase.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('submissions').select('id, problem_id, solved, language, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
                supabase.from('referrals').select('*').eq('referrer_id', userId),
                UsersService.getActivityHeatmap(userId),
                UsersService.getSkillRadar(userId),
                UsersService.getWeeklyProgress(userId),
            ]);

            if (userRes.error) throw userRes.error;

            return {
                user: userRes.data,
                subscriptions: subsRes.data || [],
                payments: paymentsRes.data || [],
                recent_submissions: submissionsRes.data || [],
                referrals: referralsRes.data || [],
                analytics: {
                    activity: activityRes,
                    radar: radarRes,
                    weekly: weeklyRes,
                },
            };

        } catch (error) {
            logger.error('Get user detail error:', { userId, error });
            throw new Error('Failed to fetch user details');
        }
    }

    /**
     * Update user role
     */
    static async updateUserRole(adminId: string, targetUserId: string, newRole: string) {
        try {
            if (!['user', 'admin', 'super_admin'].includes(newRole)) {
                throw new Error('Invalid role');
            }

            const { error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', targetUserId);

            if (error) throw error;

            // Log the action
            await this.createAuditLog(adminId, 'update_role', {
                target_user: targetUserId,
                new_role: newRole,
            });

            await CacheService.delPattern(`user:${targetUserId}:*`);

            return { message: `User role updated to ${newRole}` };
        } catch (error: any) {
            logger.error('Update role error:', { adminId, targetUserId, error: error.message });
            throw error;
        }
    }

    /**
     * Ban/unban user
     */
    static async toggleUserBan(adminId: string, targetUserId: string, banned: boolean) {
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_banned: banned, banned_at: banned ? new Date().toISOString() : null })
                .eq('id', targetUserId);

            if (error) throw error;

            await this.createAuditLog(adminId, banned ? 'ban_user' : 'unban_user', {
                target_user: targetUserId,
            });

            await CacheService.delPattern(`user:${targetUserId}:*`);

            return { message: `User ${banned ? 'banned' : 'unbanned'} successfully` };
        } catch (error) {
            logger.error('Toggle ban error:', { adminId, targetUserId, error });
            throw new Error('Failed to update user ban status');
        }
    }

    // ── Content Management ──────────────────────────────────

    /**
     * Create or update a problem
     */
    static async upsertProblem(adminId: string, problemData: any) {
        try {
            const isUpdate = !!problemData.id;

            const { data, error } = isUpdate
                ? await supabase
                    .from('problems')
                    .update(problemData)
                    .eq('id', problemData.id)
                    .select()
                    .single()
                : await supabase
                    .from('problems')
                    .insert(problemData)
                    .select()
                    .single();

            if (error) throw error;

            await this.createAuditLog(adminId, isUpdate ? 'update_problem' : 'create_problem', {
                problem_id: data?.id,
                title: problemData.title,
            });

            // Invalidate problems cache
            await CacheService.delPattern('problems:*');

            return data;
        } catch (error) {
            logger.error('Upsert problem error:', { adminId, error });
            throw new Error('Failed to save problem');
        }
    }

    /**
     * Delete a problem
     */
    static async deleteProblem(adminId: string, problemId: string) {
        try {
            const { error } = await supabase
                .from('problems')
                .delete()
                .eq('id', problemId);

            if (error) throw error;

            await this.createAuditLog(adminId, 'delete_problem', { problem_id: problemId });
            await CacheService.delPattern('problems:*');

            return { message: 'Problem deleted' };
        } catch (error) {
            logger.error('Delete problem error:', { adminId, problemId, error });
            throw new Error('Failed to delete problem');
        }
    }

    // ── Audit Logs ──────────────────────────────────────────

    /**
     * Create an audit log entry
     */
    static async createAuditLog(adminId: string, action: string, details: Record<string, any>) {
        try {
            await supabase.from('admin_logs').insert({
                admin_id: adminId,
                action,
                resource_type: details.resource_type || null,
                resource_id: details.resource_id || null,
                old_value: details.old_value || null,
                new_value: details.new_value || null,
                ip_address: null,
                created_at: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Audit log creation error:', { adminId, action, error });
            // Don't throw — audit log failure shouldn't block the operation
        }
    }

    /**
     * Get audit logs with filtering
     */
    static async getAuditLogs(page: number = 1, limit: number = 50, action?: string) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('admin_logs')
                .select('*, admin:users!admin_id(full_name, email)', { count: 'exact' });

            if (action) {
                query = query.eq('action', action);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return {
                logs: data || [],
                total: count || 0,
                page,
                total_pages: Math.ceil((count || 0) / limit),
            };
        } catch (error) {
            logger.error('Get audit logs error:', error);
            throw new Error('Failed to fetch audit logs');
        }
    }

    // ── Withdrawal Management ───────────────────────────────

    /**
     * Get pending withdrawals
     */
    static async getWithdrawals(status: string = 'pending', page: number = 1, limit: number = 20) {
        try {
            const offset = (page - 1) * limit;

            const { data, count, error } = await supabase
                .from('withdrawals')
                .select('*, user:users(full_name, email)', { count: 'exact' })
                .eq('status', status)
                .order('requested_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return {
                withdrawals: data || [],
                total: count || 0,
                page,
                total_pages: Math.ceil((count || 0) / limit),
            };
        } catch (error) {
            logger.error('Get withdrawals error:', error);
            throw new Error('Failed to fetch withdrawals');
        }
    }

    /**
     * Process withdrawal (approve/reject)
     */
    static async processWithdrawal(adminId: string, withdrawalId: string, action: 'approve' | 'reject') {
        try {
            const { data: withdrawal, error: fetchError } = await supabase
                .from('withdrawals')
                .select('*')
                .eq('id', withdrawalId)
                .single();

            if (fetchError || !withdrawal) {
                throw new Error('Withdrawal not found');
            }

            if (withdrawal.status !== 'pending') {
                throw new Error('Withdrawal already processed');
            }

            if (action === 'approve') {
                await supabase
                    .from('withdrawals')
                    .update({ status: 'approved', processed_at: new Date().toISOString(), processed_by: adminId })
                    .eq('id', withdrawalId);
            } else {
                // Refund to wallet
                const { data: user } = await supabase
                    .from('users')
                    .select('wallet_balance')
                    .eq('id', withdrawal.user_id)
                    .single();

                if (user) {
                    await supabase
                        .from('users')
                        .update({ wallet_balance: (user.wallet_balance || 0) + withdrawal.amount })
                        .eq('id', withdrawal.user_id);
                }

                await supabase
                    .from('withdrawals')
                    .update({ status: 'rejected', processed_at: new Date().toISOString(), processed_by: adminId })
                    .eq('id', withdrawalId);

                await CacheService.delPattern(`user:${withdrawal.user_id}:*`);
            }

            await this.createAuditLog(adminId, `withdrawal_${action}`, { withdrawal_id: withdrawalId });

            return { message: `Withdrawal ${action}d successfully` };
        } catch (error: any) {
            logger.error('Process withdrawal error:', { adminId, withdrawalId, error: error.message });
            throw error;
        }
    }

    // ── Flagged Referrals ───────────────────────────────────

    /**
     * Get suspicious referrals for review
     */
    static async getFlaggedReferrals(page: number = 1, limit: number = 20) {
        try {
            const offset = (page - 1) * limit;

            const { data, count, error } = await supabase
                .from('referrals')
                .select('*, referrer:users!referrer_id(full_name, email), referred:users!referred_user_id(full_name, email)', { count: 'exact' })
                .eq('is_suspicious', true)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return {
                referrals: data || [],
                total: count || 0,
                page,
                total_pages: Math.ceil((count || 0) / limit),
            };
        } catch (error) {
            logger.error('Get flagged referrals error:', error);
            throw new Error('Failed to fetch flagged referrals');
        }
    }
}
