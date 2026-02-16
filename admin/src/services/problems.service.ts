import api from './api';

export interface Problem {
    id: string;
    title: string;
    slug: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    category_id: string;
    description: string;
    test_cases: any[];
    code_templates: any[];
    is_premium: boolean;
    created_at: string;
}

export interface ProblemsListResponse {
    problems: Problem[];
    total: number;
    page: number;
    limit: number;
}

export const problemsService = {
    listProblems: async (page = 1, limit = 10, search = ''): Promise<ProblemsListResponse> => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (search) {
            params.append('search', search);
        }
        // Use public endpoint for listing
        const response = await api.get<ProblemsListResponse>(`/problems?${params.toString()}`);
        return response.data;
    },

    getProblem: async (slug: string): Promise<Problem> => {
        const response = await api.get<Problem>(`/problems/${slug}`);
        return response.data;
    },

    createProblem: async (data: Partial<Problem>): Promise<Problem> => {
        const response = await api.post<Problem>('/admin/problems', data);
        return response.data;
    },

    updateProblem: async (id: string, data: Partial<Problem>): Promise<Problem> => {
        const response = await api.put<Problem>(`/admin/problems/${id}`, data);
        return response.data;
    },

    deleteProblem: async (id: string): Promise<void> => {
        await api.delete(`/admin/problems/${id}`);
    },

    importProblems: async (sheetUrl: string): Promise<any> => {
        const response = await api.post('/admin/problems/import', { sheet_url: sheetUrl });
        return response.data;
    },
};
