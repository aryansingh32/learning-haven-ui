import api from './api';
import type { LoginCredentials, AuthResponse, User } from '../types/auth';

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<{ success: boolean; data: AuthResponse; error?: { message: string } }>('/auth/signin', credentials);
        if (!response.data?.success || !response.data?.data) {
            throw new Error(response.data?.error?.message || 'Login failed');
        }
        return response.data.data;
    },

    getProfile: async (): Promise<User> => {
        const response = await api.get<User>('/users/me');
        return response.data;
    },

    logout: async () => {
        try {
            await api.post('/auth/signout');
        } finally {
            localStorage.removeItem('token');
        }
    }
};
