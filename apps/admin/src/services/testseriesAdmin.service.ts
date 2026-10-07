import api from './api';

const BASE = '/admin/test-series';

export interface ExamCategory {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    is_active: boolean;
    sort_order: number;
    series_count: number;
}

export interface TestSeries {
    id: string;
    exam_category_id: string;
    exam_category_name: string;
    slug: string;
    title: string;
    description: string | null;
    year: number | null;
    is_free: boolean;
    price: number;
    is_published: boolean;
    test_count: number;
}

export interface TestSection {
    id: string;
    test_id: string;
    name: string;
    duration_seconds: number | null;
    sort_order: number;
}

export interface BankQuestion {
    id: string;
    question_type: 'mcq' | 'msq' | 'nat';
    body: string;
    options: { id: string; text: string }[] | null;
    correct_options: string[] | null;
    nat_answer: number | null;
    nat_tolerance: number;
    marks: number;
    negative_marks: number;
    topic: string | null;
    difficulty: 'easy' | 'medium' | 'hard' | null;
    explanation: string | null;
    created_at: string;
}

export interface TestQuestionRow extends BankQuestion {
    test_question_id: string;
    section_id: string | null;
    sort_order: number;
}

export interface AdminTest {
    id: string;
    test_series_id: string | null;
    slug: string;
    title: string;
    instructions: string | null;
    duration_seconds: number;
    is_sectional: boolean;
    section_time_locked: boolean;
    is_free: boolean;
    release_at: string | null;
    is_published: boolean;
    sort_order: number;
    question_count: number;
}

export interface AdminTestDetail extends AdminTest {
    sections: TestSection[];
    questions: TestQuestionRow[];
}

export const testseriesAdminService = {
    // Exam categories
    listExamCategories: async (): Promise<ExamCategory[]> => (await api.get(`${BASE}/exam-categories`)).data,
    createExamCategory: async (data: Partial<ExamCategory>) => (await api.post(`${BASE}/exam-categories`, data)).data,
    updateExamCategory: async (id: string, data: Partial<ExamCategory>) =>
        (await api.patch(`${BASE}/exam-categories/${id}`, data)).data,
    deleteExamCategory: async (id: string) => api.delete(`${BASE}/exam-categories/${id}`),

    // Series
    listSeries: async (examCategoryId?: string): Promise<TestSeries[]> =>
        (await api.get(`${BASE}/series`, { params: examCategoryId ? { exam_category_id: examCategoryId } : {} })).data,
    getSeries: async (id: string): Promise<TestSeries> => (await api.get(`${BASE}/series/${id}`)).data,
    createSeries: async (data: Record<string, unknown>) => (await api.post(`${BASE}/series`, data)).data,
    updateSeries: async (id: string, data: Record<string, unknown>) => (await api.patch(`${BASE}/series/${id}`, data)).data,
    deleteSeries: async (id: string) => api.delete(`${BASE}/series/${id}`),

    // Tests
    listTests: async (testSeriesId?: string): Promise<AdminTest[]> =>
        (await api.get(`${BASE}/tests`, { params: testSeriesId ? { test_series_id: testSeriesId } : {} })).data,
    getTest: async (id: string): Promise<AdminTestDetail> => (await api.get(`${BASE}/tests/${id}`)).data,
    createTest: async (data: Record<string, unknown>) => (await api.post(`${BASE}/tests`, data)).data,
    updateTest: async (id: string, data: Record<string, unknown>) => (await api.patch(`${BASE}/tests/${id}`, data)).data,
    deleteTest: async (id: string) => api.delete(`${BASE}/tests/${id}`),

    // Sections
    addSection: async (testId: string, data: { name: string; durationSeconds?: number; sortOrder?: number }) =>
        (await api.post(`${BASE}/tests/${testId}/sections`, data)).data,
    updateSection: async (sectionId: string, data: Partial<{ name: string; durationSeconds: number; sortOrder: number }>) =>
        (await api.patch(`${BASE}/sections/${sectionId}`, data)).data,
    deleteSection: async (sectionId: string) => api.delete(`${BASE}/sections/${sectionId}`),

    // Test <-> question assignment
    attachQuestion: async (testId: string, questionId: string, sectionId?: string | null) =>
        (await api.post(`${BASE}/tests/${testId}/questions`, { questionId, sectionId })).data,
    detachQuestion: async (testId: string, questionId: string) => api.delete(`${BASE}/tests/${testId}/questions/${questionId}`),
    reorderQuestions: async (testId: string, orderedQuestionIds: string[]) =>
        api.patch(`${BASE}/tests/${testId}/questions/reorder`, { orderedQuestionIds }),

    // Question bank
    listQuestions: async (params: {
        search?: string;
        topic?: string;
        difficulty?: string;
        question_type?: string;
        page?: number;
        limit?: number;
    }): Promise<{ questions: BankQuestion[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> =>
        (await api.get(`${BASE}/questions`, { params })).data,
    listTopics: async (): Promise<string[]> => (await api.get(`${BASE}/questions/topics`)).data,
    createQuestion: async (data: Record<string, unknown>) => (await api.post(`${BASE}/questions`, data)).data,
    updateQuestion: async (id: string, data: Record<string, unknown>) => (await api.patch(`${BASE}/questions/${id}`, data)).data,
    deleteQuestion: async (id: string) => api.delete(`${BASE}/questions/${id}`),
};
