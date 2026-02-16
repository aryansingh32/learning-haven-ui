import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

export class TasksService {
    /**
     * Create a new task
     */
    static async createTask(userId: string, data: {
        title: string;
        description?: string;
        type?: string;
        problem_id?: string;
        roadmap_id?: string;
        due_date?: string;
        priority?: string;
        xp_reward?: number;
    }) {
        try {
            const { data: task, error } = await supabase
                .from('tasks')
                .insert({
                    user_id: userId,
                    title: data.title,
                    description: data.description || null,
                    type: data.type || 'custom',
                    problem_id: data.problem_id || null,
                    roadmap_id: data.roadmap_id || null,
                    due_date: data.due_date || new Date().toISOString().split('T')[0],
                    priority: data.priority || 'medium',
                    xp_reward: data.xp_reward || 10,
                })
                .select()
                .single();

            if (error) throw error;

            await CacheService.del(`tasks:${userId}:*`);
            return task;
        } catch (error) {
            logger.error('Create task error:', { userId, error });
            throw new Error('Failed to create task');
        }
    }

    /**
     * List user's tasks with filters
     */
    static async listTasks(userId: string, filters: {
        date?: string;
        status?: string;
        type?: string;
        page?: number;
        limit?: number;
    } = {}) {
        try {
            const page = filters.page || 1;
            const limit = filters.limit || 50;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('tasks')
                .select('*, problems(title, slug, difficulty, topic)', { count: 'exact' })
                .eq('user_id', userId);

            if (filters.date) {
                query = query.eq('due_date', filters.date);
            }
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.type) {
                query = query.eq('type', filters.type);
            }

            query = query
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            return {
                tasks: data || [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit),
                },
            };
        } catch (error) {
            logger.error('List tasks error:', { userId, error });
            throw new Error('Failed to list tasks');
        }
    }

    /**
     * Update a task
     */
    static async updateTask(userId: string, taskId: string, data: {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        due_date?: string;
    }) {
        try {
            const updates: any = { ...data };

            // Set completed_at when marking as completed
            if (data.status === 'completed') {
                updates.completed_at = new Date().toISOString();
            }

            const { data: task, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;

            // Award XP on completion
            if (data.status === 'completed' && task.xp_reward > 0) {
                await supabase.rpc('increment_xp', {
                    p_user_id: userId,
                    p_amount: task.xp_reward,
                });
            }

            await CacheService.del(`tasks:${userId}:*`);
            return task;
        } catch (error) {
            logger.error('Update task error:', { userId, taskId, error });
            throw new Error('Failed to update task');
        }
    }

    /**
     * Delete a task
     */
    static async deleteTask(userId: string, taskId: string) {
        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)
                .eq('user_id', userId);

            if (error) throw error;

            await CacheService.del(`tasks:${userId}:*`);
            return { message: 'Task deleted' };
        } catch (error) {
            logger.error('Delete task error:', { userId, taskId, error });
            throw new Error('Failed to delete task');
        }
    }

    /**
     * Get task summary for dashboard
     */
    static async getTaskSummary(userId: string) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('tasks')
                .select('status')
                .eq('user_id', userId)
                .eq('due_date', today);

            if (error) throw error;

            const tasks = data || [];
            return {
                date: today,
                total: tasks.length,
                completed: tasks.filter(t => t.status === 'completed').length,
                pending: tasks.filter(t => t.status === 'pending').length,
                in_progress: tasks.filter(t => t.status === 'in_progress').length,
                skipped: tasks.filter(t => t.status === 'skipped').length,
            };
        } catch (error) {
            logger.error('Task summary error:', { userId, error });
            throw new Error('Failed to get task summary');
        }
    }

    /**
     * Admin: Assign task to a specific user
     */
    static async assignTask(adminId: string, targetUserId: string, data: {
        title: string;
        description?: string;
        problem_id?: string;
        due_date?: string;
        priority?: string;
        xp_reward?: number;
    }) {
        try {
            const { data: task, error } = await supabase
                .from('tasks')
                .insert({
                    user_id: targetUserId,
                    title: data.title,
                    description: data.description || null,
                    type: 'admin_assigned',
                    problem_id: data.problem_id || null,
                    due_date: data.due_date || new Date().toISOString().split('T')[0],
                    priority: data.priority || 'medium',
                    xp_reward: data.xp_reward || 20,
                    assigned_by: adminId,
                    is_admin_assigned: true,
                })
                .select()
                .single();

            if (error) throw error;
            return task;
        } catch (error) {
            logger.error('Assign task error:', { adminId, targetUserId, error });
            throw new Error('Failed to assign task');
        }
    }

    /**
     * Admin: Assign task to ALL users
     */
    static async assignTaskToAll(adminId: string, data: {
        title: string;
        description?: string;
        problem_id?: string;
        due_date?: string;
        priority?: string;
        xp_reward?: number;
    }) {
        try {
            // Get all active users
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id')
                .is('deleted_at', null);

            if (usersError) throw usersError;

            const tasks = (users || []).map(user => ({
                user_id: user.id,
                title: data.title,
                description: data.description || null,
                type: 'admin_assigned' as const,
                problem_id: data.problem_id || null,
                due_date: data.due_date || new Date().toISOString().split('T')[0],
                priority: data.priority || 'medium',
                xp_reward: data.xp_reward || 20,
                assigned_by: adminId,
                is_admin_assigned: true,
            }));

            if (tasks.length === 0) return { count: 0 };

            const { error } = await supabase.from('tasks').insert(tasks);
            if (error) throw error;

            return { count: tasks.length, message: `Task assigned to ${tasks.length} users` };
        } catch (error) {
            logger.error('Assign task to all error:', { adminId, error });
            throw new Error('Failed to assign tasks');
        }
    }
}
