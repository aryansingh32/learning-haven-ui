import api from './api';

export const withdrawalsService = {
    list: async (page = 1, limit = 20) => {
        const res = await api.get(`/admin/withdrawals?page=${page}&limit=${limit}`);
        return res.data;
    },
    process: async (id: string, action: 'approve' | 'reject', notes?: string) => {
        const res = await api.post(`/admin/withdrawals/${id}/process`, { action, notes });
        return res.data;
    },
};
