import api from './api';

export interface Roadmap {
    id: string;
    title: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    items?: RoadmapItem[];
}

export interface RoadmapItem {
    id: string;
    roadmap_id: string;
    problem_id: string;
    order_index: number;
    problem?: any;
}

export const roadmapsService = {
    list: async () => {
        const res = await api.get<Roadmap[]>('/admin/roadmaps');
        return res.data;
    },
    create: async (data: Partial<Roadmap>) => {
        const res = await api.post<Roadmap>('/admin/roadmaps', data);
        return res.data;
    },
    update: async (id: string, data: Partial<Roadmap>) => {
        const res = await api.put<Roadmap>(`/admin/roadmaps/${id}`, data);
        return res.data;
    },
    delete: async (id: string) => {
        await api.delete(`/admin/roadmaps/${id}`);
    },
    addItem: async (id: string, data: { problem_id: string; order_index?: number }) => {
        const res = await api.post(`/admin/roadmaps/${id}/items`, data);
        return res.data;
    },
    removeItem: async (id: string, itemId: string) => {
        await api.delete(`/admin/roadmaps/${id}/items/${itemId}`);
    },
    reorderItems: async (id: string, items: { id: string; order_index: number }[]) => {
        const res = await api.put(`/admin/roadmaps/${id}/reorder`, { items });
        return res.data;
    },
};
