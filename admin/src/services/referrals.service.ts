import api from './api';

export const referralsService = {
    getStats: async () => {
        const res = await api.get('/admin/referrals/stats');
        return res.data;
    },
    listAll: async (page = 1, limit = 20) => {
        const res = await api.get(`/admin/referrals/all?page=${page}&limit=${limit}`);
        return res.data;
    },
    getFlagged: async () => {
        const res = await api.get('/admin/referrals/flagged');
        return res.data;
    },
    verify: async (id: string) => {
        const res = await api.put(`/admin/referrals/${id}/verify`);
        return res.data;
    },
    reject: async (id: string) => {
        const res = await api.put(`/admin/referrals/${id}/reject`);
        return res.data;
    },
};
