// Forge Campus (college) API client for the learner app.
//
// Campus runs as its own API (apps/campus-api) but uses the same Supabase
// accounts, so we send the learner's existing access token. Nothing here is
// required for Forge-only learners: every call fails quietly when the Campus
// API isn't configured, and the UI simply hides the college area.

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ensureValidAccessToken, getAccessToken, getRefreshToken, refreshAccessToken } from '@/lib/authSession';

const CAMPUS_BASE_URL = (import.meta.env.VITE_CAMPUS_API_URL || '/campus/v1').replace(/\/+$/, '');

const client = axios.create({ baseURL: CAMPUS_BASE_URL, timeout: 20_000 });

client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = (await ensureValidAccessToken()) || getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export class CampusApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

client.interceptors.response.use(
  (res) => res.data,
  async (error: AxiosError<{ error?: string }>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    if (status === 401 && config && !config._retry && getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        config._retry = true;
        config.headers.Authorization = `Bearer ${refreshed}`;
        return client.request(config);
      }
    }
    const message = error.response?.data?.error
      || (error.code === 'ERR_NETWORK' ? 'You seem to be offline. Your answers are safe — reconnect and try again.' : error.message);
    return Promise.reject(new CampusApiError(message, status));
  }
);

// ── Types (mirror apps/campus-api responses) ─────────────────────────────

export type CampusRole = 'owner' | 'admin' | 'placement_officer' | 'faculty' | 'evaluator' | 'invigilator' | 'student';

export interface CampusMembership {
  orgId: string;
  orgName: string;
  slug: string;
  type: 'platform' | 'college';
  logoUrl: string | null;
  brandColor: string | null;
  role: CampusRole;
  rollNumber: string | null;
  departmentId: string | null;
  permissions: string[];
}

export interface CampusMe {
  claimed: number;
  memberships: CampusMembership[];
  isPlatformAdmin: boolean;
}

export type AssignmentState = 'upcoming' | 'open' | 'closed';

export interface MyAssignment {
  id: string;
  title: string;
  instructions: string | null;
  college: string;
  batch: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  state: AssignmentState;
  maxAttempts: number;
  attemptsUsed: number;
  latestAttemptId: string | null;
  latestStatus: 'in_progress' | 'completed' | null;
  resultsReleased: boolean;
  bestScore: number | null;
  totalMarks: number | null;
  proctoring: ProctoringPolicy;
  /** Set when the test runs one timed section at a time (no going back). */
  timedSections?: Array<{ name: string; minutes: number }> | null;
}

export type AnswerStatus = 'not_visited' | 'visited' | 'answered' | 'marked_for_review' | 'answered_marked';

export interface AttemptAnswer {
  question_id: string;
  status: AnswerStatus;
  selected_options: string[] | null;
  nat_value: number | null;
  /** coding questions: the saved program and its language. */
  code?: string | null;
  language?: CodeLanguage | null;
}

export type CodeLanguage = 'python' | 'java' | 'cpp' | 'javascript';

export interface ExamQuestion {
  id: string;
  type: 'mcq' | 'msq' | 'nat' | 'coding';
  body: string;
  options: Array<{ id: string; text: string }> | null;
  marks: number;
  negativeMarks: number;
  section: string | null;
  passage: string | null;
  /** coding only: allowed languages, their starter code, and the sample tests (hidden tests never reach the browser). */
  languages?: CodeLanguage[];
  starterCode?: Partial<Record<CodeLanguage, string>>;
  samples?: Array<{ input: string; expected: string }>;
}

/** What running code on a coding question's sample tests returned. */
export interface CodeRunResult {
  verdict: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compilation Error' | 'Time Limit Exceeded';
  passed: number;
  total: number;
  tests: Array<{ index: number; passed: boolean; isSample: boolean; actual?: string; error?: string }>;
  message?: string;
  timeMs: number;
}

export interface ProctoringPolicy {
  enabled: boolean;
  requireFullscreen: boolean;
  blockClipboard: boolean;
  warnFirst: boolean;
  maxViolations: number | null;
}

export interface QuestionResult {
  questionId: string;
  attempted: boolean;
  isCorrect: boolean | null;
  marksAwarded: number;
  /** coding only */
  testsPassed?: number;
  testsTotal?: number;
  pending?: boolean;
}

export type AttemptResult =
  | { released: false }
  | {
      released: true;
      score: number;
      totalMarks: number;
      correctCount: number | null;
      totalQuestions: number;
      perQuestion: QuestionResult[];
    };

export interface AttemptView {
  attemptId: string;
  assignment: { id: string; title: string; instructions: string | null; closesAt: string };
  status: 'in_progress' | 'completed';
  attemptNumber: number;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  proctoring: ProctoringPolicy;
  violationCount: number;
  questions: ExamQuestion[];
  answers?: AttemptAnswer[];
  submitReason: 'manual' | 'timeout' | 'violations' | 'closed' | 'invigilator' | null;
  result?: AttemptResult;
  /** Timed sections: the plan, and where this attempt is. Questions are the current section's only. */
  sections?: Array<{ id: string; name: string; durationSeconds: number; questionCount: number }> | null;
  currentSection?: { index: number; endsAt: string } | null;
}

export type ProctoringEvent = 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'copy' | 'paste' | 'context_menu';

export interface EventResult {
  severity: 'warning' | 'violation' | null;
  violationCount: number;
  maxViolations?: number | null;
  autoSubmitted: boolean;
}

// ── Calls ───────────────────────────────────────────────────────────────

/** Also attaches any roster entries the college pre-registered for this email. */
export const fetchCampusMe = (): Promise<CampusMe> => client.get('/me');

export const fetchMyAssignments = (): Promise<MyAssignment[]> => client.get('/my/assignments');

export const startAssignment = (assignmentId: string): Promise<AttemptView> =>
  client.post(`/my/assignments/${assignmentId}/start`);

// Opening an attempt whose time ran out submits (and judges) it, so allow time.
export const fetchAttemptView = (attemptId: string): Promise<AttemptView> => client.get(`/my/attempts/${attemptId}`, { timeout: 120_000 });

export const saveCampusAnswer = (
  attemptId: string,
  questionId: string,
  body: { selectedOptions?: string[] | null; natValue?: number | null; code?: string | null; language?: CodeLanguage | null; markedForReview?: boolean }
): Promise<{ questionId: string; status: AnswerStatus }> =>
  client.put(`/my/attempts/${attemptId}/answers/${questionId}`, body);

/** Run code on the sample tests only. Doesn't save or score anything. */
export const runCampusCode = (attemptId: string, questionId: string, body: { code: string; language: CodeLanguage }): Promise<CodeRunResult> =>
  client.post(`/my/attempts/${attemptId}/questions/${questionId}/run`, body, { timeout: 60_000 });

export const reportProctoringEvent = (attemptId: string, type: ProctoringEvent): Promise<EventResult> =>
  client.post(`/my/attempts/${attemptId}/events`, { type });

/** "Still here" ping so invigilators can see who has dropped off. */
export const campusHeartbeat = (attemptId: string): Promise<{ status: 'in_progress' | 'completed'; expiresAt: string }> =>
  client.post(`/my/attempts/${attemptId}/heartbeat`);

/** Finish the current timed section early; returns the next section (or the result after the last). */
export const finishCampusSection = (attemptId: string): Promise<AttemptView> =>
  client.post(`/my/attempts/${attemptId}/sections/finish`, undefined, { timeout: 120_000 });

// Submitting judges any coding answers on the server, which can take a while.
export const submitCampusAttempt = (attemptId: string): Promise<AttemptView> =>
  client.post(`/my/attempts/${attemptId}/submit`, undefined, { timeout: 120_000 });

/** Colleges where this person is a student (staff roles use the Campus portal). */
export const studentMemberships = (me: CampusMe | undefined) =>
  (me?.memberships ?? []).filter((m) => m.type === 'college' && m.role === 'student');
