import { api, unwrap } from '../../../services/api.svc';
import { supabase } from '../../../lib/supabase';

const BASE = '/v1/build';

export interface BuildChallenge {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  status: string;
  [key: string]: unknown;
}

export interface BuildWorkspace {
  id: string;
  slug: string;
  [key: string]: unknown;
}

export interface BuildEnrollment {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface BuildRepository {
  full_name: string;
  [key: string]: unknown;
}

export interface BuildLeaderboardEntry {
  user_id: string;
  [key: string]: unknown;
}

export interface BuildEvent {
  type: string;
  payload: Record<string, unknown>;
}

export const buildHavenService = {
  getMyEnrollments: () =>
    unwrap<{ enrollments: BuildEnrollment[] }>(api.get(`${BASE}/enrollments`)),
  listChallenges: (params?: { difficulty?: string; status?: string; language?: string }) =>
    unwrap<{ challenges: BuildChallenge[]; total: number }>(api.get(`${BASE}/challenges`, { params })),
  getChallengeBySlug: (slug: string) =>
    unwrap<{ challenge: BuildChallenge }>(api.get(`${BASE}/challenges/${slug}`)),
  getWorkspace: (slug: string, params?: { language?: string }) =>
    unwrap<{ workspace: BuildWorkspace }>(api.get(`${BASE}/challenges/${slug}/workspace`, { params })),
  getLeaderboard: (slug: string, params?: { language?: string }) =>
    unwrap<{ leaderboard: BuildLeaderboardEntry[] }>(api.get(`${BASE}/challenges/${slug}/leaderboard`, { params })),
  startChallenge: (slug: string, language: string, buildMode: 'traditional' | 'vibe' = 'traditional') =>
    unwrap<{ enrollment: BuildEnrollment; repository: BuildRepository | null; clone_command: string | null }>(
      api.post(`${BASE}/challenges/${slug}/start`, { language, build_mode: buildMode }, {
        headers: { 'Idempotency-Key': crypto.randomUUID() }
      })
    ),
  vibeSubmitStage: (enrollmentId: string, stageId: string, submissionRef: string, submissionSource: 'github_push' | 'live_url' = 'github_push') =>
    unwrap<{ result: Record<string, unknown> }>(
      api.post(`${BASE}/enrollments/${enrollmentId}/stages/${stageId}/vibe-submit`, {
        submission_ref: submissionRef,
        submission_source: submissionSource,
      })
    ),
  celebrateStage: (slug: string, stageNumber: number) =>
    unwrap<void>(api.post(`${BASE}/challenges/${slug}/stages/${stageNumber}/celebrate`)),
  subscribeToEnrollmentEvents: (enrollmentId: string, callback: (event: BuildEvent) => void) => {
    if (!supabase) return () => {};
    const channel = supabase.channel(`build:${enrollmentId}`)
      .on('broadcast', { event: 'attempt_started' }, (payload) => callback({ type: 'attempt_started', payload }))
      .on('broadcast', { event: 'verification_started' }, (payload) => callback({ type: 'verification_started', payload }))
      .on('broadcast', { event: 'verification_queued' }, (payload) => callback({ type: 'verification_queued', payload }))
      .on('broadcast', { event: 'log_line' }, (payload) => callback({ type: 'log_line', payload: payload.payload ?? payload }))
      .on('broadcast', { event: 'stage_result' }, (payload) => callback({ type: 'stage_result', payload: payload.payload ?? payload }))
      .on('broadcast', { event: 'verification_complete' }, (payload) => callback({ type: 'verification_complete', payload: payload.payload ?? payload }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

