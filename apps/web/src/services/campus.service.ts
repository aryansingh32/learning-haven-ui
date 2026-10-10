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
  /** Colleges the learner belongs to that Forge has suspended or archived. */
  unavailableColleges?: { orgName: string; status: 'suspended' | 'archived'; role: string }[];
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
  /** Extra time granted to this student (already in durationMinutes). */
  extraPercent?: number;
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
  /** fill-in-the-blank and written answers */
  text_value?: string | null;
}

export type CodeLanguage = 'python' | 'java' | 'cpp' | 'javascript';

export interface ExamQuestion {
  id: string;
  type: 'mcq' | 'msq' | 'nat' | 'coding' | 'tf' | 'fib' | 'descriptive';
  body: string;
  options: Array<{ id: string; text: string }> | null;
  /** descriptive: word limit, if any */
  maxWords?: number;
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
  /** an evaluator's comment on this answer */
  feedback?: string;
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
      /** an evaluator's overall comment */
      feedback?: string | null;
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

export type CourseAssignmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

/** A Learn course (or some of its chapters) the student's college assigned. */
export interface MyCourseAssignment {
  id: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  orgName: string;
  batchName: string;
  courseId: string;
  courseTitle: string | null;
  courseSlug: string | null;
  coverImage: string | null;
  wholeCourse: boolean;
  chapters: Array<{ id: string; number: number; title: string; done: boolean }>;
  status: CourseAssignmentStatus;
  completedChapters: number;
  totalChapters: number;
  percent: number;
}

export type NotificationKind =
  | 'test_assigned' | 'test_closing' | 'result_released' | 'feedback' | 'course_assigned' | 'course_due'
  | 'drive_announced' | 'drive_update' | 'job_alert' | 'announcement'
  | 'community_reply' | 'team_request' | 'team_update';
export interface AppNotification { id: string; kind: NotificationKind; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }
export interface NotificationPreferences { emailEnabled: boolean; dailyDigest: boolean; mutedKinds: NotificationKind[] }

export type DriveStatus = 'registered' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn';
export interface MyDrive {
  id: string; company: string; roleTitle: string; description: string | null; jobType: 'full_time' | 'internship' | 'internship_ppo';
  ctc: string | null; location: string | null; applyBy: string | null; status: 'open' | 'closed'; orgName: string;
  canApply: boolean; myStatus: DriveStatus | null;
  rounds: Array<{ name: string; kind: string; scheduledAt: string | null; assignmentId: string | null }>;
}

// ── Calls ───────────────────────────────────────────────────────────────

/** Also attaches any roster entries the college pre-registered for this email. */
export const fetchCampusMe = (): Promise<CampusMe> => client.get('/me');

/** Notes, links and files the learner's colleges published to them (their college, their batch). */
export interface StudyMaterial {
  id: string; orgId: string; college: string | null; title: string; kind: 'note' | 'link' | 'file';
  body: string | null; url: string | null; tags: string[]; batchName: string | null; updatedAt: string;
}
export const fetchMyMaterials = (): Promise<StudyMaterial[]> => client.get('/my/materials');

export const fetchMyAssignments = (): Promise<MyAssignment[]> => client.get('/my/assignments');

export const fetchNotifications = (): Promise<{ unread: number; rows: AppNotification[] }> => client.get('/me/notifications');
export const markNotificationsRead = (body: { ids: string[] } | { all: true }): Promise<{ marked: number }> => client.post('/me/notifications/read', body);
export const fetchNotificationPreferences = (): Promise<NotificationPreferences> => client.get('/me/notification-preferences');
export const saveNotificationPreferences = (p: Partial<NotificationPreferences>): Promise<NotificationPreferences> => client.put('/me/notification-preferences', p);

export const fetchMyDrives = (): Promise<MyDrive[]> => client.get('/my/drives');
export const applyToDrive = (id: string): Promise<{ status: DriveStatus }> => client.post(`/my/drives/${id}/apply`);
export const withdrawFromDrive = (id: string): Promise<{ status: DriveStatus }> => client.post(`/my/drives/${id}/withdraw`);

export const fetchMyCourseAssignments = (): Promise<MyCourseAssignment[]> => client.get('/my/course-assignments');

/** Starting records the exam rules the student agreed to on the start screen. */
export const startAssignment = (assignmentId: string, rules: string[] = []): Promise<AttemptView> =>
  client.post(`/my/assignments/${assignmentId}/start`, { consent: { rules } });

// Opening an attempt whose time ran out submits (and judges) it, so allow time.
export const fetchAttemptView = (attemptId: string): Promise<AttemptView> => client.get(`/my/attempts/${attemptId}`, { timeout: 120_000 });

export const saveCampusAnswer = (
  attemptId: string,
  questionId: string,
  body: { selectedOptions?: string[] | null; natValue?: number | null; textValue?: string | null; code?: string | null; language?: CodeLanguage | null; markedForReview?: boolean }
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

// ── Community (one college's doubts, people and teams) ───────────────────

export interface CommunityPerson { id: string; name: string; avatarUrl: string | null }
export type ThreadKind = 'doubt' | 'discussion';
export interface ThreadSummary {
  id: string; kind: ThreadKind; title: string; excerpt: string; tags: string[]; teamId: string | null;
  problemId: string | null; problemTitle: string | null; problemSlug: string | null; courseId: string | null; courseTitle: string | null;
  pinned: boolean; hidden: boolean; solved: boolean; replies: number; createdAt: string; lastActivityAt: string;
  author: CommunityPerson; mine: boolean;
}
export interface ThreadPost { id: string; body: string; hidden: boolean; createdAt: string; editedAt: string | null; author: CommunityPerson; mine: boolean }
export interface ThreadDetail extends Omit<ThreadSummary, 'excerpt' | 'replies' | 'solved' | 'lastActivityAt'> {
  body: string; solvedPostId: string | null; editedAt: string | null; teamName: string | null; canModerate: boolean; posts: ThreadPost[];
}
export interface ThreadFilters { kind?: ThreadKind; problemId?: string; teamId?: string; q?: string; mine?: boolean; unanswered?: boolean }
export interface NewThread { kind: ThreadKind; title: string; body: string; tags?: string[]; problemId?: string | null; courseId?: string | null; teamId?: string | null }
export interface DirectoryCard {
  person: CommunityPerson; me: boolean; headline: string | null; bio: string | null; skills: string[]; lookingForTeam: boolean;
  githubUrl: string | null; linkedinUrl: string | null; teams: { id: string; name: string }[];
}
export interface MyCard { headline: string | null; bio: string | null; skills: string[]; lookingForTeam: boolean; githubUrl: string | null; linkedinUrl: string | null }
export type TeamStatus = 'forming' | 'building' | 'shipped' | 'archived';
export interface TeamSummary {
  id: string; name: string; excerpt: string | null; skillsNeeded: string[]; maxMembers: number; status: TeamStatus;
  repoUrl: string | null; demoUrl: string | null; members: number; lead: CommunityPerson | null; myStatus: 'requested' | 'active' | null;
}
export interface TeamMember { role: 'lead' | 'member'; status: 'active' | 'requested'; createdAt: string; person: CommunityPerson; message?: string | null }
export interface TeamDetail {
  id: string; name: string; description: string | null; skillsNeeded: string[]; maxMembers: number; status: TeamStatus;
  repoUrl: string | null; demoUrl: string | null; createdAt: string; members: TeamMember[]; requests: TeamMember[];
  myRole: 'lead' | 'member' | null; myRequest: boolean; canModerate: boolean;
}
export interface TeamInput { name: string; description?: string | null; skillsNeeded?: string[]; maxMembers?: number; status?: TeamStatus; repoUrl?: string | null; demoUrl?: string | null }
export interface CommunityReport {
  id: string; reason: string; createdAt: string; threadId: string; postId: string | null; threadTitle: string;
  excerpt: string; hidden: boolean; reporter: CommunityPerson; author: CommunityPerson;
}

const community = (orgId: string) => `/community/${orgId}`;
const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => Boolean(e[1])));
  return p.toString() ? `?${p}` : '';
};

export const fetchThreads = (orgId: string, f: ThreadFilters = {}): Promise<ThreadSummary[]> =>
  client.get(`${community(orgId)}/threads${qs({ kind: f.kind, problemId: f.problemId, teamId: f.teamId, q: f.q, mine: f.mine ? '1' : undefined, unanswered: f.unanswered ? '1' : undefined })}`);
export const createThread = (orgId: string, t: NewThread): Promise<{ id: string }> => client.post(`${community(orgId)}/threads`, t);
export const fetchThread = (orgId: string, id: string): Promise<ThreadDetail> => client.get(`${community(orgId)}/threads/${id}`);
export const updateThread = (orgId: string, id: string, patch: { title?: string; body?: string; tags?: string[]; solvedPostId?: string | null }) =>
  client.patch(`${community(orgId)}/threads/${id}`, patch);
export const moderateThread = (orgId: string, id: string, m: { hidden?: boolean; pinned?: boolean }) => client.post(`${community(orgId)}/threads/${id}/moderate`, m);
export const deleteThread = (orgId: string, id: string) => client.delete(`${community(orgId)}/threads/${id}`);
export const replyToThread = (orgId: string, id: string, body: string): Promise<{ id: string }> => client.post(`${community(orgId)}/threads/${id}/posts`, { body });
export const updatePost = (orgId: string, id: string, body: string) => client.patch(`${community(orgId)}/posts/${id}`, { body });
export const moderatePost = (orgId: string, id: string, hidden: boolean) => client.post(`${community(orgId)}/posts/${id}/moderate`, { hidden });
export const deletePost = (orgId: string, id: string) => client.delete(`${community(orgId)}/posts/${id}`);
export const reportContent = (orgId: string, r: { threadId?: string; postId?: string; reason: string }) => client.post(`${community(orgId)}/reports`, r);

export const fetchDirectory = (orgId: string, f: { q?: string; looking?: boolean } = {}): Promise<DirectoryCard[]> =>
  client.get(`${community(orgId)}/people${qs({ q: f.q, looking: f.looking ? '1' : undefined })}`);
export const fetchMyCard = (orgId: string): Promise<MyCard | null> => client.get(`${community(orgId)}/people/me`);
export const saveMyCard = (orgId: string, card: MyCard) => client.put(`${community(orgId)}/people/me`, card);
export const leaveDirectory = (orgId: string) => client.delete(`${community(orgId)}/people/me`);

export const fetchTeams = (orgId: string, f: { all?: boolean; mine?: boolean } = {}): Promise<TeamSummary[]> =>
  client.get(`${community(orgId)}/teams${qs({ status: f.all ? 'all' : undefined, mine: f.mine ? '1' : undefined })}`);
export const createTeam = (orgId: string, t: TeamInput): Promise<{ id: string }> => client.post(`${community(orgId)}/teams`, t);
export const fetchTeam = (orgId: string, id: string): Promise<TeamDetail> => client.get(`${community(orgId)}/teams/${id}`);
export const updateTeam = (orgId: string, id: string, t: Partial<TeamInput>) => client.patch(`${community(orgId)}/teams/${id}`, t);
export const deleteTeam = (orgId: string, id: string) => client.delete(`${community(orgId)}/teams/${id}`);
export const askToJoinTeam = (orgId: string, id: string, message?: string) => client.post(`${community(orgId)}/teams/${id}/join`, { message });
export const acceptTeamRequest = (orgId: string, id: string, userId: string) => client.post(`${community(orgId)}/teams/${id}/members/${userId}/accept`);
export const removeTeamMember = (orgId: string, id: string, userId: string) => client.delete(`${community(orgId)}/teams/${id}/members/${userId}`);
