import api from './api';

export interface Plan {
    id: string;
    name: string;
    slug: string;
    price: number;
    duration_days: number;
    features: Record<string, any>;
    is_active: boolean;
    created_at: string;
}

export const plansService = {
    list: async () => {
        const res = await api.get<Plan[]>('/admin/plans');
        return res.data;
    },
    create: async (data: Partial<Plan>) => {
        const res = await api.post<Plan>('/admin/plans', data);
        return res.data;
    },
    update: async (id: string, data: Partial<Plan>) => {
        const res = await api.put<Plan>(`/admin/plans/${id}`, data);
        return res.data;
    },
    delete: async (id: string) => {
        await api.delete(`/admin/plans/${id}`);
    },
};
