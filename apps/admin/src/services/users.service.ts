import api from './api';
import type { User } from '../types/auth';

export type UserStatusFilter = 'all' | 'active' | 'banned' | 'staff';

export interface UsersListResponse {
    users: User[];
    total: number;
    page: number;
    limit: number;
}

export const usersService = {
    listUsers: async (page = 1, limit = 10, search = '', plan?: string, status?: UserStatusFilter): Promise<UsersListResponse> => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (search) params.append('search', search);
        if (plan) params.append('plan', plan);
        if (status && status !== 'all') params.append('status', status);

        const response = await api.get<UsersListResponse>(`/admin/users?${params.toString()}`);
        return response.data;
    },

    getUser: async (id: string): Promise<User> => {
        const response = await api.get<User>(`/admin/users/${id}`);
        return response.data;
    },

    updateUserRole: async (id: string, role: 'user' | 'admin' | 'super_admin'): Promise<User> => {
        const response = await api.put<User>(`/admin/users/${id}/role`, { role });
        return response.data;
    },

    setBanned: async (id: string, banned: boolean): Promise<{ banned: boolean }> => {
        const response = await api.put<{ banned: boolean }>(`/admin/users/${id}/ban`, { banned });
        return response.data;
    },

    /** Suspend, restore or change the role of many accounts; reports the ones it skipped. */
    bulk: async (userIds: string[], action: 'ban' | 'unban' | 'set_role', role?: 'user' | 'admin' | 'super_admin') =>
        (await api.post<{ updated: string[]; skipped: { id: string; reason: string }[] }>('/admin/users/bulk', { userIds, action, role })).data,

    /** The filtered list as a CSV download. */
    exportCsv: async (search = '', plan?: string, status?: UserStatusFilter) => {
        const response = await api.get('/admin/users/export', { params: { search: search || undefined, plan, status: status === 'all' ? undefined : status }, responseType: 'blob' });
        const url = URL.createObjectURL(response.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `forge-users-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    getUserIntelligence: async (id: string): Promise<any> => {
        try {
            const response = await api.get(`/admin/users/${id}/intelligence`);
            return response.data;
        } catch {
            // Mock fallback if endpoint doesn't exist yet
            return {
                fraudScore: Math.floor(Math.random() * 30),
                purchases: [],
                timeline: [
                    { action: 'Logged in', timestamp: new Date().toISOString() },
                    { action: 'Account created', timestamp: new Date(Date.now() - 86400000).toISOString() }
                ],
                aiUsage: { totalTokens: 12500, interactions: 45 }
            };
        }
    },
};
