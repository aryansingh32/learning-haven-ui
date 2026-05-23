import api from './api';

const BASE = '/v1/build/admin';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function unwrap<T>(promise: Promise<any>): Promise<T> {
  const response = await promise;
  const envelope = response.data as Envelope<T>;
  if (!envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.error || 'Build Haven admin request failed');
  }
  return envelope.data;
}

export const buildHavenAdminApi = {
  listChallenges: () => unwrap<{ challenges: any[] }>(api.get(`${BASE}/challenges`)),
  createChallenge: (payload: any) => unwrap<{ challenge: any }>(api.post(`${BASE}/challenges`, payload)),
  updateChallenge: (id: string, payload: any) => unwrap<{ challenge: any }>(api.put(`${BASE}/challenges/${id}`, payload)),
  getChallenge: (id: string) => unwrap<{ challenge: any; stages: any[]; languages: any[] }>(api.get(`${BASE}/challenges/${id}`)),
  createStage: (programId: string, payload: any) => unwrap<{ stage: any }>(api.post(`${BASE}/challenges/${programId}/stages`, payload)),
  updateStage: (stageId: string, payload: any) => unwrap<{ stage: any }>(api.put(`${BASE}/stages/${stageId}`, payload)),
  deleteStage: (stageId: string) => unwrap<{ message: string }>(api.delete(`${BASE}/stages/${stageId}`)),
  reorderStages: (programId: string, order: { id: string; sort_order: number }[]) =>
    unwrap<{ message: string }>(api.put(`${BASE}/challenges/${programId}/stages/reorder`, { order })),
  upsertLanguage: (programId: string, payload: any) => unwrap<{ language: any }>(api.post(`${BASE}/challenges/${programId}/languages`, payload)),
  updateLanguage: (langId: string, payload: any) => unwrap<{ language: any }>(api.put(`${BASE}/languages/${langId}`, payload)),
  deleteLanguage: (programId: string, language: string) =>
    unwrap<{ message: string }>(api.delete(`${BASE}/challenges/${programId}/languages/${encodeURIComponent(language)}`)),
  deleteLanguageById: (langId: string) =>
    unwrap<{ message: string }>(api.delete(`${BASE}/languages/${langId}`)),
  deleteChallenge: (id: string) => unwrap<{ challenge: any }>(api.delete(`${BASE}/challenges/${id}`)),
  getAnalytics: (id: string) => unwrap<{ analytics: any }>(api.get(`${BASE}/challenges/${id}/analytics`)),
  getEnrollments: (programId: string, params?: { language?: string; status?: string; search?: string }) =>
    unwrap<{ enrollments: any[]; total: number }>(api.get(`${BASE}/challenges/${programId}/enrollments`, { params })),
  manualPassStage: (enrollmentId: string, stageId: string) =>
    unwrap<{ message: string }>(api.post(`${BASE}/enrollments/${enrollmentId}/stages/${stageId}/pass`)),
};
