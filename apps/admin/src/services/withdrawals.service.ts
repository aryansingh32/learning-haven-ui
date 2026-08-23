import api from './api';

export const withdrawalsService = {
    list: async (page = 1, limit = 20, status?: string) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status) params.set('status', status);
        const res = await api.get(`/admin/withdrawals?${params.toString()}`);
        return res.data;
    },
    process: async (id: string, action: 'approve' | 'reject', notes?: string) => {
        const res = await api.post(`/admin/withdrawals/${id}/process`, { action, notes });
        return res.data;
    },
};
