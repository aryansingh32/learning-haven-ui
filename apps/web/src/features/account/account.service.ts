import { api } from '@/services/api.svc';

/** Account & security, skills profile and public portfolio (slice W2-A1). `api` resolves to the response body. */

export interface AccountInfo {
  email: string | null;
  email_verified: boolean;
  email_verified_at: string | null;
  pending_email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  providers: string[];
  has_password: boolean;
}

export interface SessionRow {
  id: string;
  current: boolean;
  device: string;
  browser: string | null;
  os: string | null;
  mobile: boolean;
  ip: string | null;
  signed_in_at: string | null;
  last_active_at: string | null;
  method: string | null;
}

export interface ActivityRow {
  kind: string;
  at: string;
  source: 'account_log' | 'auth_log' | 'account' | 'payments';
  device: string | null;
  ip: string | null;
  detail: string | null;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type SkillCategory = 'language' | 'framework' | 'tool' | 'concept' | 'soft';
export interface Skill { name: string; level: SkillLevel; category: SkillCategory | null }
export interface SkillEvidence { skill: string; source: 'practice' | 'certificate' | 'project'; detail: string | null; amount: number }
export interface SkillsProfile { skills: Skill[]; evidence: SkillEvidence[]; suggestions: Array<{ name: string; category: SkillCategory | null }> }

export interface PortfolioSettings {
  handle: string;
  is_public: boolean;
  headline: string | null;
  bio: string | null;
  show_college: boolean;
  show_skills: boolean;
  show_evidence: boolean;
  show_repo_links: boolean;
  certificate_refs: string[];
  project_ids: string[];
  published_at?: string | null;
}
export interface PortfolioEditor {
  portfolio: PortfolioSettings | null;
  suggested_handle: string;
  has_college: boolean;
  email_verified: boolean;
  certificates: Array<{ ref: string; title: string; issued_at: string }>;
  projects: Array<{ id: string; title: string; language: string; status: string; stages_done: number; stages_total: number; has_repo: boolean }>;
}

export interface PublicPortfolio {
  handle: string;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  college: string | null;
  published_at: string | null;
  certificates: Array<{ kind: 'topic' | 'apprenticeship' | 'program'; title: string; issued_at: string; code: string; grade?: string | null }>;
  projects: Array<{ title: string; slug: string; tagline: string | null; language: string; status: string; stages_done: number; stages_total: number; completed_at: string | null; repo_url: string | null }>;
  skills: Array<{ name: string; level: SkillLevel; category: SkillCategory | null }>;
  evidence: Array<{ skill: string; source: 'practice'; amount: number }>;
}

export const accountApi = {
  info: () => api.get('/users/me/account') as Promise<AccountInfo>,
  sendVerification: () => api.post('/users/me/verification-email') as Promise<{ sent: boolean; email: string }>,
  resendPublic: (email: string) => api.post('/auth/resend-verification', { email }) as Promise<{ sent: boolean }>,
  sessions: () => api.get('/users/me/sessions') as Promise<{ supported: boolean; current_session_id: string | null; sessions: SessionRow[] }>,
  revokeSession: (id: string) => api.delete(`/users/me/sessions/${encodeURIComponent(id)}`) as Promise<{ revoked: number }>,
  revokeOthers: () => api.post('/users/me/sessions/revoke-others') as Promise<{ revoked: number }>,
  changePassword: (body: { current_password: string; new_password: string; sign_out_others: boolean }) =>
    api.put('/users/me/password', body) as Promise<{ changed: boolean; signed_out_sessions: number }>,
  activity: (before?: string | null) =>
    api.get('/users/me/activity', { params: { limit: 20, ...(before ? { before } : {}) } }) as Promise<{ items: ActivityRow[]; next_before: string | null }>,
  skills: () => api.get('/users/me/skills') as Promise<SkillsProfile>,
  saveSkills: (skills: Skill[]) => api.put('/users/me/skills', { skills }) as Promise<SkillsProfile>,
  portfolio: () => api.get('/users/me/portfolio') as Promise<PortfolioEditor>,
  savePortfolio: (p: PortfolioSettings) => api.put('/users/me/portfolio', p) as Promise<PortfolioEditor>,
  deletePortfolio: () => api.delete('/users/me/portfolio') as Promise<{ deleted: boolean }>,
  publicPortfolio: (handle: string) => api.get(`/portfolio/${encodeURIComponent(handle)}`) as Promise<PublicPortfolio>,
};

export const LEVELS: Array<{ value: SkillLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

export const portfolioUrl = (handle: string) => `${window.location.origin}/u/${handle}`;

export const formatWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  return formatWhen(iso);
}
