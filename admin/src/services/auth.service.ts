import api from './api';
import type { LoginCredentials, AuthResponse, User } from '../types/auth';

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/signin', credentials);
        return response.data;
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
