import api from './api';

export interface AdminChapter {
  id: string;
  roadmap_id: string;
  chapter_number: number;
  title: string;
  topic_tag?: string;
  difficulty?: string;
  est_minutes?: number;
  story_hook?: string;
  whatsapp_msg?: string;
  step_count?: number;
}

export interface AdminChapterStep {
  id?: string;
  chapter_id?: string;
  step_number: number;
  type: string;
  title: string;
  content: Record<string, unknown>;
}

export interface AdminChapterDetail {
  chapter: AdminChapter & Record<string, unknown>;
  content: Record<string, unknown> | null;
  steps: AdminChapterStep[];
}

export const chaptersAdminService = {
  list: async (roadmapId: string) => {
    const res = await api.get<{ chapters: AdminChapter[] }>(`/admin/chapters?roadmap_id=${roadmapId}`);
    return res.data.chapters;
  },
  get: async (id: string) => {
    const res = await api.get<AdminChapterDetail>(`/admin/chapters/${id}`);
    return res.data;
  },
  create: async (data: Partial<AdminChapter>) => {
    const res = await api.post('/admin/chapters', data);
    return res.data.chapter;
  },
  update: async (id: string, data: Partial<AdminChapter>) => {
    const res = await api.put(`/admin/chapters/${id}`, data);
    return res.data.chapter;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/chapters/${id}`);
  },
  replaceSteps: async (id: string, steps: unknown[]) => {
    const res = await api.put(`/admin/chapters/${id}/steps`, { steps });
    return res.data.steps;
  },
  upsertContent: async (id: string, content: Record<string, unknown>) => {
    const res = await api.put(`/admin/chapters/${id}/content`, content);
    return res.data.content;
  },
};
