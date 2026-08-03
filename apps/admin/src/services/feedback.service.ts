import api from './api';

export interface Feedback {
    id: string;
    user_id: string;
    type: string;
    message: string;
    status: string;
    created_at: string;
    user?: { full_name: string; email: string };
}

export const feedbackService = {
    list: async (page = 1, limit = 20) => {
        const res = await api.get(`/admin/feedback?page=${page}&limit=${limit}`);
        return res.data;
    },
    updateStatus: async (id: string, status: string) => {
        const res = await api.put(`/admin/feedback/${id}`, { status });
        return res.data;
    },
};
