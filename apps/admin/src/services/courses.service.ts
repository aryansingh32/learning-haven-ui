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
    price?: number | null;
    currency?: string;
    is_individually_purchasable?: boolean;
    items?: CourseItem[];
}

export interface CourseItem {
    id: string;
    course_id: string;
    problem_id: string;
    order_index: number;
    problem?: any;
}

export interface CourseLearningSettings {
    course_id: string;
    /** Chapter N opens (N-1) × this many days after the learner starts. null = no drip. */
    drip_interval_days: number | null;
    prerequisites: { course_id: string; title: string; slug: string }[];
}

export type CourseExportType = 'chapters_meta' | 'chapter_steps';

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
    bulkDelete: async (ids: string[]) => {
        const res = await api.post('/admin/courses/bulk-delete', { ids });
        return res.data;
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
    getLearningSettings: async (id: string) => {
        const res = await api.get<CourseLearningSettings>(`/admin/courses/${id}/learning-settings`);
        return res.data;
    },
    saveLearningSettings: async (id: string, data: { drip_interval_days: number | null; prerequisite_ids: string[] }) => {
        const res = await api.put<CourseLearningSettings>(`/admin/courses/${id}/learning-settings`, data);
        return res.data;
    },
    /** CSV in the content-import format, so a course can be edited in a spreadsheet and imported back. */
    exportCourse: async (id: string, type: CourseExportType) => {
        const res = await api.get<Blob>(`/admin/courses/${id}/export`, { params: { type }, responseType: 'blob' });
        return res.data;
    },
};
