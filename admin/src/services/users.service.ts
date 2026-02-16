import api from './api';
import type { User } from '../types/auth';

export interface UsersListResponse {
    users: User[];
    total: number;
    page: number;
    limit: number;
}

export const usersService = {
    listUsers: async (page = 1, limit = 10, search = ''): Promise<UsersListResponse> => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (search) {
            params.append('search', search);
        }

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

    toggleUserBan: async (id: string): Promise<{ banned: boolean }> => {
        const response = await api.put<{ banned: boolean }>(`/admin/users/${id}/ban`);
        return response.data;
    },
};
