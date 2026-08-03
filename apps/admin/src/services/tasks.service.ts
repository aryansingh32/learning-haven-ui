import api from './api';

export const tasksService = {
    assignToUser: async (userId: string, data: { title: string; description?: string; problem_id?: string; due_date?: string }) => {
        const res = await api.post(`/admin/tasks/assign/${userId}`, data);
        return res.data;
    },
    assignToAll: async (data: { title: string; description?: string; problem_id?: string; due_date?: string }) => {
        const res = await api.post('/admin/tasks/assign-all', data);
        return res.data;
    },
};
