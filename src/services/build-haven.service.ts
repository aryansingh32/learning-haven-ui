import api from './api.svc';
import { supabase } from '../lib/supabase';

const BASE = '/v1/build';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function unwrap<T>(promise: Promise<any>): Promise<T> {
  const response = await promise;
  if (!response?.success || response.data === undefined) {
    throw new Error(response?.error || 'Build Haven request failed');
  }
  return response.data;
}

export const buildHavenService = {
  listChallenges: (params?: { difficulty?: string; status?: string; language?: string }) =>
    unwrap<{ challenges: any[]; total: number }>(api.get(`${BASE}/challenges`, { params })),
  getChallengeBySlug: (slug: string) =>
    unwrap<{ challenge: any }>(api.get(`${BASE}/challenges/${slug}`)),
  getWorkspace: (slug: string, params?: { language?: string }) =>
    unwrap<{ workspace: any }>(api.get(`${BASE}/challenges/${slug}/workspace`, { params })),
  getLeaderboard: (slug: string, params?: { language?: string }) =>
    unwrap<{ leaderboard: any[] }>(api.get(`${BASE}/challenges/${slug}/leaderboard`, { params })),
  startChallenge: (slug: string, language: string) =>
    unwrap<{ enrollment: any; repository: any; clone_command: string }>(api.post(`${BASE}/challenges/${slug}/start`, { language })),
  celebrateStage: (slug: string, stageNumber: number) =>
    unwrap<void>(api.post(`${BASE}/challenges/${slug}/stages/${stageNumber}/celebrate`)),
  subscribeToEnrollmentEvents: (enrollmentId: string, callback: (event: any) => void) => {
    if (!supabase) return () => {};
    const channel = supabase.channel(`build:${enrollmentId}`)
      .on('broadcast', { event: 'attempt_started' }, (payload) => callback({ type: 'attempt_started', payload }))
      .on('broadcast', { event: 'verification_started' }, (payload) => callback({ type: 'verification_started', payload }))
      .on('broadcast', { event: 'stage_result' }, (payload) => callback({ type: 'stage_result', payload }))
      .on('broadcast', { event: 'verification_complete' }, (payload) => callback({ type: 'verification_complete', payload }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
