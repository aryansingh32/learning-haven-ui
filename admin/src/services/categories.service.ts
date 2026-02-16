import api from './api';

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    order_index: number;
    is_active: boolean;
    patterns?: any[];
}

export const categoriesService = {
    listCategories: async (): Promise<Category[]> => {
        const response = await api.get<Category[]>('/categories');
        return response.data;
    },

    getCategory: async (id: string): Promise<Category> => {
        const response = await api.get<Category>(`/categories/${id}`);
        return response.data;
    },

    create: async (data: Partial<Category>): Promise<Category> => {
        const response = await api.post<Category>('/admin/categories', data);
        return response.data;
    },

    update: async (id: string, data: Partial<Category>): Promise<Category> => {
        const response = await api.put<Category>(`/admin/categories/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/admin/categories/${id}`);
    },
};
