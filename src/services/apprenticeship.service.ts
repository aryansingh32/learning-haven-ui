import api from './api.svc';

const BASE = '/v1/apprenticeship';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class ApprenticeshipApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApprenticeshipApiError';
    this.code = code;
  }
}

async function unwrap<T>(promise: Promise<Envelope<T>>): Promise<T> {
  const response = await promise;

  if (!response?.success || response.data === undefined) {
    throw new ApprenticeshipApiError(
      response?.error || 'Apprenticeship request failed',
      response?.code
    );
  }

  return response.data;
}

export const apprenticeshipService = {
  getPrograms: (params?: { difficulty?: string; tech_stack?: string }) =>
    unwrap(api.get(`${BASE}/programs`, { params })),

  getProgramBySlug: (slug: string) =>
    unwrap(api.get(`${BASE}/programs/${slug}`)),

  getLeaderboard: (programId: string, type: 'fastest' | 'quality' | 'helpful' = 'fastest') =>
    unwrap(api.get(`${BASE}/leaderboard/${programId}?type=${type}`)),

  getMyEnrollments: () =>
    unwrap(api.get(`${BASE}/enrollments/mine`)),

  getEnrollment: (enrollmentId: string) =>
    unwrap(api.get(`${BASE}/enrollments/${enrollmentId}`)),

  getProjectWorkspace: (projectId: string) =>
    unwrap(api.get(`${BASE}/projects/${projectId}`)),

  startProject: (projectId: string) =>
    unwrap(api.post(`${BASE}/projects/${projectId}/start`)),

  getMySubmissions: (params?: { enrollmentId?: string; projectId?: string }) =>
    unwrap(api.get(`${BASE}/submissions/mine`, { params })),

  getSubmissionStatus: (submissionId: string) =>
    unwrap(api.get(`${BASE}/submissions/${submissionId}/status`)),

  getSubmissionStages: (submissionId: string) =>
    unwrap(api.get(`${BASE}/submissions/${submissionId}/stages`)),

  getCommunityPosts: (programId: string, params?: { projectId?: string; sort?: string; page?: number; limit?: number }) =>
    unwrap(api.get(`${BASE}/community/${programId}/posts`, { params })),

  createPost: (programId: string, data: { content: string; projectId?: string }) =>
    unwrap(api.post(`${BASE}/community/${programId}/posts`, data)),

  toggleUpvote: (postId: string) =>
    unwrap(api.post(`${BASE}/community/posts/${postId}/upvote`)),

  createReply: (postId: string, content: string) =>
    unwrap(api.post(`${BASE}/community/posts/${postId}/replies`, { content })),

  getAIHelp: (data: {
    projectId: string;
    question: string;
    context?: Record<string, unknown>;
  }) => unwrap(api.post(`${BASE}/ai/project-help`, data)),

  createOrder: (data: { programId: string; couponCode?: string }) =>
    unwrap(api.post(`${BASE}/payments/create-order`, data)),

  enroll: (data: {
    programId: string;
    paymentId: string;
    orderId: string;
    signature: string;
    referralCode?: string | null;
    couponCode?: string;
  }) => unwrap(api.post(`${BASE}/enroll`, data)),

  getGithubAuthUrl: (returnTo?: string) =>
    unwrap(
      api.get(`${BASE}/auth/github`, {
        params: returnTo ? { return_to: returnTo } : undefined,
      })
    ),

  getGithubStatus: () =>
    unwrap(api.get(`${BASE}/auth/github/status`)),

  disconnectGithub: () =>
    unwrap(api.delete(`${BASE}/auth/github`)),

  verifyCertificate: (code: string) =>
    unwrap(api.get(`${BASE}/certificates/verify/${code}`)),
};
