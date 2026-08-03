import api from './api';

export interface Pattern {
    id: string;
    name: string;
    slug: string;
    description?: string;
    category_id?: string;
    created_at: string;
}

export const patternsService = {
    create: async (data: Partial<Pattern>) => {
        const res = await api.post<Pattern>('/admin/patterns', data);
        return res.data;
    },
    update: async (id: string, data: Partial<Pattern>) => {
        const res = await api.put<Pattern>(`/admin/patterns/${id}`, data);
        return res.data;
    },
    delete: async (id: string) => {
        await api.delete(`/admin/patterns/${id}`);
    },
    linkProblem: async (patternId: string, problemId: string) => {
        const res = await api.post('/admin/patterns/link', { pattern_id: patternId, problem_id: problemId });
        return res.data;
    },
    unlinkProblem: async (patternId: string, problemId: string) => {
        const res = await api.post('/admin/patterns/unlink', { pattern_id: patternId, problem_id: problemId });
        return res.data;
    },
};
