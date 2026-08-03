import api from './api';

export interface Course {
    id: string;
    title: string;
    description?: string;
    cover_image?: string;
    difficulty_level?: string;
    duration_days?: number;
    is_premium?: boolean;
    is_published?: boolean;
    is_active: boolean;
    created_at: string;
    items?: CourseItem[];
}

export interface CourseItem {
    id: string;
    course_id: string;
    problem_id: string;
    order_index: number;
    problem?: any;
}

export const coursesService = {
    list: async () => {
        const res = await api.get<Course[]>('/admin/courses');
        return res.data;
    },
    create: async (data: Partial<Course>) => {
        const res = await api.post<Course>('/admin/courses', data);
        return res.data;
    },
    update: async (id: string, data: Partial<Course>) => {
        const res = await api.put<Course>(`/admin/courses/${id}`, data);
        return res.data;
    },
    delete: async (id: string) => {
        await api.delete(`/admin/courses/${id}`);
    },
    addItem: async (id: string, data: { problem_id: string; order_index?: number }) => {
        const res = await api.post(`/admin/courses/${id}/items`, data);
        return res.data;
    },
    removeItem: async (id: string, itemId: string) => {
        await api.delete(`/admin/courses/${id}/items/${itemId}`);
    },
    reorderItems: async (id: string, items: { id: string; order_index: number }[]) => {
        const res = await api.put(`/admin/courses/${id}/reorder`, { items });
        return res.data;
    },
};
