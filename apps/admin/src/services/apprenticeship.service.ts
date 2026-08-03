import api from './api';

const BASE = '/v1/apprenticeship';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

async function unwrap<T>(promise: Promise<any>): Promise<T> {
  const response = await promise;
  const envelope = response.data as Envelope<T>;

  if (!envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.error || 'Apprenticeship admin request failed');
  }

  return envelope.data;
}

export const apprenticeshipApi = {
  listPrograms: () => unwrap<{ programs: any[]; total: number }>(api.get(`${BASE}/admin/programs`)),
  getProgram: (id: string) => unwrap<{ program: any }>(api.get(`${BASE}/admin/programs/${id}`)),
  createProgram: (data: any) => unwrap<{ program: any }>(api.post(`${BASE}/admin/programs`, data)),
  updateProgram: (id: string, data: any) => unwrap<{ program: any }>(api.put(`${BASE}/admin/programs/${id}`, data)),
  archiveProgram: (id: string) => unwrap<{ message: string }>(api.delete(`${BASE}/admin/programs/${id}`)),
  reorderProjects: (programId: string, order: { id: string; sort_order: number }[]) =>
    unwrap<{ message: string }>(api.put(`${BASE}/admin/programs/${programId}/reorder-projects`, { order })),
  listProjects: (programId: string) => unwrap<{ projects: any[] }>(api.get(`${BASE}/admin/programs/${programId}/projects`)),
  getProject: (id: string) => unwrap<{ project: any }>(api.get(`${BASE}/admin/projects/${id}`)),
  createProject: (programId: string, data: any) =>
    unwrap<{ project: any }>(api.post(`${BASE}/admin/programs/${programId}/projects`, data)),
  updateProject: (id: string, data: any) => unwrap<{ project: any }>(api.put(`${BASE}/admin/projects/${id}`, data)),
  deleteProject: (id: string) => unwrap<{ message: string }>(api.delete(`${BASE}/admin/projects/${id}`)),
  listSubmissions: (params?: Record<string, string | undefined>) =>
    unwrap<{ submissions: any[] }>(api.get(`${BASE}/admin/submissions`, { params })),
  reviewSubmission: (id: string, data: any) =>
    unwrap<{ submission: any }>(api.put(`${BASE}/admin/submissions/${id}/review`, data)),
  getOverview: () => unwrap<{ overview: any }>(api.get(`${BASE}/admin/overview`)),
  getStudents: (params?: Record<string, string | undefined>) =>
    unwrap<{ students: any[] }>(api.get(`${BASE}/admin/students`, { params })),
  getStudentDetail: (userId: string) => unwrap<{ detail: any }>(api.get(`${BASE}/admin/students/${userId}`)),
  getAnalytics: (params?: Record<string, string | undefined>) =>
    unwrap<{ analytics: any }>(api.get(`${BASE}/admin/analytics`, { params })),
  listCoupons: () => unwrap<{ coupons: any[] }>(api.get(`${BASE}/admin/coupons`)),
  createCoupon: (data: any) => unwrap<{ coupon: any }>(api.post(`${BASE}/admin/coupons`, data)),
  updateCoupon: (id: string, data: any) => unwrap<{ coupon: any }>(api.put(`${BASE}/admin/coupons/${id}`, data)),
  deleteCoupon: (id: string) => unwrap<{ message: string }>(api.delete(`${BASE}/admin/coupons/${id}`)),
  broadcastNotification: (data: any) =>
    unwrap<{ result: any }>(api.post(`${BASE}/admin/notifications/broadcast`, data)),
  getCommunityPosts: (programId: string, params?: Record<string, string | number | undefined>) =>
    unwrap<{ posts: any[] }>(api.get(`${BASE}/community/${programId}/posts`, { params })),
  createPost: (programId: string, data: any) => unwrap<{ post: any }>(api.post(`${BASE}/community/${programId}/posts`, data)),
  toggleUpvote: (postId: string) => unwrap<{ upvoted: boolean; upvotes: number }>(api.post(`${BASE}/community/posts/${postId}/upvote`)),
  createReply: (postId: string, content: string) => unwrap<{ reply: any }>(api.post(`${BASE}/community/posts/${postId}/replies`, { content })),
  listPublicPrograms: () => unwrap<{ programs: any[]; total: number }>(api.get(`${BASE}/programs`)),
  getPublicProgram: (slug: string) => unwrap<{ program: any }>(api.get(`${BASE}/programs/${slug}`)),
};
