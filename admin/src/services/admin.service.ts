import api from './api';

export const adminService = {
    // Dashboard
    getDashboard: async () => {
        const res = await api.get('/admin/dashboard');
        return res.data;
    },

    // Analytics
    getAnalytics: async () => {
        const res = await api.get('/admin/analytics');
        return res.data;
    },

    // System Settings
    getSettings: async () => {
        const res = await api.get('/admin/settings');
        return res.data;
    },
    updateSettings: async (settings: Record<string, any>) => {
        const res = await api.put('/admin/settings', settings);
        return res.data;
    },

    // Audit Logs
    getAuditLogs: async (page = 1, limit = 20) => {
        const res = await api.get(`/admin/logs?page=${page}&limit=${limit}`);
        return res.data;
    },

    // Leaderboard Config
    getLeaderboardConfig: async () => {
        const res = await api.get('/admin/leaderboard/config');
        return res.data;
    },
    updateLeaderboardConfig: async (config: Record<string, any>) => {
        const res = await api.put('/admin/leaderboard/config', config);
        return res.data;
    },

    // AI Config
    getAIConfig: async () => {
        const res = await api.get('/admin/ai/config');
        return res.data;
    },
    updateAIConfig: async (config: Record<string, any>) => {
        const res = await api.put('/admin/ai/config', config);
        return res.data;
    },
};
