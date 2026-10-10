export type Role = 'owner' | 'admin' | 'placement_officer' | 'faculty' | 'evaluator' | 'invigilator' | 'student';

export type Permission =
  | 'org.manage' | 'org.billing' | 'members.manage' | 'members.view' | 'batches.manage'
  | 'content.create' | 'assessments.create' | 'assessments.grade' | 'assessments.invigilate'
  | 'reports.view' | 'reports.export' | 'records.view' | 'placements.manage' | 'community.moderate';

export interface Membership {
  orgId: string;
  orgName: string;
  slug: string;
  type: 'platform' | 'college';
  logoUrl: string | null;
  brandColor: string | null;
  role: Role;
  rollNumber: string | null;
  permissions: Permission[];
  customRoleId?: string | null;
  customRoleName?: string | null;
}

export interface Me {
  claimed: number;
  memberships: Membership[];
  isPlatformAdmin: boolean;
  /** Colleges the person belongs to that Forge has suspended or archived. */
  unavailableColleges?: { orgName: string; status: 'suspended' | 'archived'; role: string }[];
}

export interface Org {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  emailDomains: string[];
  seatLimit: number | null;
  activeStudents: number;
}

export type UnitKind = 'school' | 'department' | 'branch';
export interface Department { id: string; name: string; code: string; kind: UnitKind; parentId: string | null; students: number; batches: number }
export interface Section { id: string; name: string; students: number }
export interface AcademicRecord { cgpa: number | null; backlogs: number | null; tenthPercent: number | null; twelfthPercent: number | null }
export interface Eligibility { minCgpa?: number; maxBacklogs?: number; minTenth?: number; minTwelfth?: number; departmentIds?: string[] }
export interface CollegeDefaults {
  resultRelease: 'immediately' | 'after_close' | 'manual'; shuffle: boolean; maxAttempts: number;
  lockdown: boolean; maxViolations: number | null; courseDueDays: number;
}

export interface Batch {
  id: string;
  name: string;
  academicYear: string | null;
  graduationYear: number | null;
  status: 'active' | 'archived';
  departmentId: string | null;
  departmentName: string | null;
  studentCount: number;
  sections: Section[];
}

export interface Member {
  userId: string;
  role: Role;
  status: 'active' | 'suspended' | 'invited';
  rollNumber: string | null;
  department: string | null;
  departmentId: string | null;
  batches: string[];
  /** Only for staff who keep academic records. */
  record?: AcademicRecord;
  customRoleId?: string | null;
  customRoleName?: string | null;
  fullName?: string | null;
  email?: string;
}

export interface RosterIssue { line: number; message: string }
export interface RosterPreview {
  errors: RosterIssue[];
  summary: { valid: number; new: number; alreadyRegistered: number; invalid: number };
  rows: Array<{ line: number; email: string; fullName: string | null; rollNumber: string | null; department: string | null; batch: string | null; section: string | null; cgpa: number | null; backlogs: number | null; role: Role; existing: 'pending' | 'claimed' | null }>;
}

export interface RosterEntry {
  id: string; email: string; fullName: string | null; role: Role; rollNumber: string | null;
  status: 'pending' | 'claimed' | 'revoked'; department: string | null; batch: string | null;
}

export interface TestSummary {
  id: string;
  title: string;
  durationMinutes: number;
  published: boolean;
  source: 'college' | 'forge' | 'shared';
  sharedBy?: string | null;
  sharedWith?: number;
  questionCount: number;
}

export type QuestionType = 'mcq' | 'msq' | 'nat' | 'coding' | 'tf' | 'fib' | 'descriptive';

export interface Question {
  id: string;
  type: QuestionType;
  body: string;
  options: Array<{ id: string; text: string }> | null;
  correctOptions: string[] | null;
  tags: string[];
  /** fib */
  acceptedAnswers?: string[] | null;
  caseSensitive?: boolean;
  /** descriptive */
  rubric?: string | null;
  maxWords?: number | null;
  natAnswer: number | null;
  natTolerance: number;
  marks: number;
  negativeMarks: number;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  // coding only
  starterCode?: Partial<Record<CodeLanguage, string>>;
  compare?: CompareMode;
  tests?: Array<{ input: string; expected: string; isSample: boolean }>;
  sectionId: string | null;
}

export interface TestSection {
  id: string;
  name: string;
  durationMinutes: number | null;
  /** Pool: deal this many of the section's questions to each student. */
  drawCount: number | null;
  questionCount: number;
}

export type CodeLanguage = 'python' | 'java' | 'cpp' | 'javascript';
export type CompareMode = 'exact' | 'unordered' | 'unordered_deep';

export interface TestDetail {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  published: boolean;
  /** Students take one section at a time, each with its own timer, and can't go back. */
  sectionTimeLocked: boolean;
  /** Pool for questions not in any section. */
  drawCount: number | null;
  sections: TestSection[];
  questions: Question[];
}

export interface Assignment {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  opensAt: string;
  closesAt: string;
  maxAttempts: number;
  resultRelease: 'immediately' | 'after_close' | 'manual';
  resultsReleasedAt: string | null;
  batchId: string;
  batchName: string;
  testId: string;
  testTitle: string | null;
  sectionId: string | null;
  sectionName: string | null;
  eligibility: Eligibility;
  assigned: number;
  started: number;
  submitted: number;
}

export interface ResultRow {
  userId: string;
  rollNumber: string | null;
  name: string | null;
  email: string | null;
  status: 'submitted' | 'in_progress' | 'not_attempted';
  score: number | null;
  totalMarks: number | null;
  percent: number | null;
  attempts: number;
  violations: number;
  submitReason: 'manual' | 'timeout' | 'violations' | 'closed' | 'invigilator' | null;
  submittedAt: string | null;
  gradingPending: boolean;
  markingPending: boolean;
  paperVersion: string | null;
  review: ReviewOutcome | null;
}

export interface Results {
  assignment: { id: string; title: string; batch: string };
  summary: {
    assigned: number; submitted: number; notAttempted: number;
    averagePercent: number | null; highestPercent: number | null; lowestPercent: number | null; flagged: number;
    gradingPending: number;
    markingPending: number;
  };
  rows: ResultRow[];
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  placement_officer: 'Placement officer',
  faculty: 'Faculty',
  evaluator: 'Evaluator',
  invigilator: 'Invigilator',
  student: 'Student',
};

export type LiveStatus = 'not_started' | 'active' | 'offline' | 'submitted';
export type ReviewOutcome = 'no_issue' | 'warning' | 'malpractice';

export interface LiveRow {
  userId: string;
  name: string | null;
  email: string;
  rollNumber: string | null;
  status: LiveStatus;
  attemptId: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  submittedAt: string | null;
  submitReason: string | null;
  lastSeenAt: string | null;
  answered: number;
  total: number;
  section: { index: number; count: number; name: string; endsAt: string } | null;
  violations: number;
  lastEvent: { type: string; severity: 'warning' | 'violation'; at: string } | null;
  review: { outcome: ReviewOutcome; at: string } | null;
  extraMinutes: number;
}

export interface LiveBoard {
  assignment: { id: string; title: string; batch: string; opensAt: string; closesAt: string };
  serverNow: string;
  summary: { assigned: number; notStarted: number; active: number; offline: number; submitted: number; needsReview: number };
  rows: LiveRow[];
}

export type TimelineItem =
  | { at: string; kind: 'started' }
  | { at: string; kind: 'event'; type: string; severity: 'warning' | 'violation' }
  | { at: string; kind: 'extend' | 'force_submit'; minutes: number | null; reason: string; by: string | null }
  | { at: string; kind: 'review'; outcome: ReviewOutcome; note: string | null; by: string | null }
  | { at: string; kind: 'submitted'; reason: string | null };

export interface Accommodation {
  userId: string;
  name: string | null;
  rollNumber: string | null;
  extraPercent: number;
  note: string | null;
}

// ── Courses for colleges (D6) ───────────────────────────────────────────────
export interface CollegeCourse {
  id: string; title: string; slug: string; description: string | null; difficulty: string | null; coverImage: string | null;
  isPremium: boolean; owner: 'forge' | 'college'; chapters: number; minutes: number; licensed: boolean;
}
export interface CourseChapter { id: string; number: number; title: string; minutes: number | null }
export interface CollegeCourseDetail extends CollegeCourse { chapterList: CourseChapter[] }

export interface CourseAssignment {
  id: string; title: string; status: 'draft' | 'published' | 'archived'; dueAt: string | null; createdAt: string;
  batchId: string; batchName: string; sectionName: string | null; courseId: string; courseTitle: string | null; chapters: number; wholeCourse: boolean;
  assigned: number; completed: number; inProgress: number; overdue: number;
}
export type StudentCourseStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export interface CourseProgressReport {
  assignment: { id: string; title: string; status: string; instructions: string | null; dueAt: string | null; batch: string; courseId: string; courseTitle: string | null; wholeCourse: boolean };
  chapters: Array<{ id: string; number: number; title: string }>;
  summary: { assigned: number; completed: number; inProgress: number; notStarted: number; overdue: number; averagePercent: number | null };
  rows: Array<{
    userId: string; rollNumber: string | null; name: string | null; email: string | null; status: StudentCourseStatus;
    completedChapters: number; totalChapters: number; percent: number; lastActivity: string | null; completedAt: string | null; chapters: boolean[];
  }>;
}

// ── Marking written answers ─────────────────────────────────────────────────
export interface MarkingAnswer {
  attemptId: string; student: string; rollNumber: string | null; text: string;
  marks: number | null; feedback: string | null; autoCorrect?: boolean;
}
export interface MarkingQuestion {
  id: string; number: number; type: 'descriptive' | 'fib'; body: string; marks: number; rubric: string | null;
  acceptedAnswers: string[] | null; maxWords: number | null; answers: MarkingAnswer[]; pending: number;
}
export interface MarkingScript { attemptId: string; student: string; rollNumber: string | null; score: number; totalMarks: number; feedback: string | null }
export interface Marking { assignment: { id: string; title: string }; blind: boolean; scripts: MarkingScript[]; questions: MarkingQuestion[] }

// ── Analytics (C2b) ─────────────────────────────────────────────────────────
export interface QuestionAnalysis {
  questionId: string; number: number; type: QuestionType; body: string; section: string | null; marks: number; tags: string[];
  dealt: number; attempted: number; correct: number; pending: number;
  difficulty: number | null; discrimination: number | null; averageMarks: number | null;
  optionPicks?: Record<string, number>; options: Array<{ id: string; text: string; correct: boolean }> | null; flag: string | null;
}
export interface AssignmentAnalysis {
  assignment: { id: string; title: string; batch: string };
  summary: { assigned: number; submitted: number; participation: number | null; average: number | null; median: number | null; highest: number | null; lowest: number | null };
  distribution: Array<{ from: number; to: number; count: number }>;
  questions: QuestionAnalysis[];
  tags: Array<{ tag: string; questions: number; earned: number; possible: number; percent: number | null }>;
}
export type RiskLevel = 'high' | 'medium' | 'low';
export interface StudentInsight {
  userId: string; rollNumber: string | null; name: string | null; email: string | null; department: string | null; batches: string[];
  assigned: number; taken: number; missed: number; averagePercent: number | null; lastTestAt: string | null;
  overdueCourses: number; coursesCompleted: number; coursesAssigned: number; malpractice: boolean;
  risk: { level: RiskLevel; reasons: string[]; averagePercent: number | null; missed: number };
  record?: AcademicRecord;
}
export interface StudentsInsight { days: number; summary: { students: number; high: number; medium: number; averagePercent: number | null }; rows: StudentInsight[] }
export interface Rollup { name: string; students: number; averagePercent: number | null; participation: number | null; atRisk: number; coursesCompleted: number; coursesAssigned: number }
export interface CollegeOverview {
  months: Array<{ month: string; tests: number; assigned: number; submitted: number; participation: number | null; averagePercent: number | null }>;
  byBatch: Rollup[]; byDepartment: Rollup[];
}
export interface StudentReport {
  student: { userId: string; name: string | null; email: string | null; rollNumber: string | null; department: string | null };
  record?: AcademicRecord;
  risk: { level: RiskLevel; reasons: string[] };
  averagePercent: number | null;
  tests: Array<{ assignmentId: string; title: string; closesAt: string; closed: boolean; score: number | null; totalMarks: number | null; percent: number | null; rank: number | null; of: number; batchAverage: number | null }>;
  courses: Array<{ id: string; title: string; dueAt: string | null; status: StudentCourseStatus; completedChapters: number; totalChapters: number; percent: number }>;
  topics: Array<{ tag: string; percent: number | null; possible: number }>;
}

// ── Roles and activity (C2c) ────────────────────────────────────────────────
export interface CustomRole { id: string; name: string; description: string | null; permissions: Permission[]; members: number; createdAt: string }
export interface ActivityRow {
  id: number; at: string; action: 'create' | 'update' | 'delete' | 'export'; entity: string; what: string; entityId: string | null;
  summary: string | null; changes: Record<string, unknown> | null; actorId: string | null; actor: string | null;
}

// ── Placement drives (C3) ───────────────────────────────────────────────────
export type DriveDecision = 'registered' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn';
export interface Drive {
  id: string; company: string; roleTitle: string; description: string | null; jobType: 'full_time' | 'internship' | 'internship_ppo';
  ctc: string | null; location: string | null; batchIds: string[]; eligibility: Eligibility; applyBy: string | null;
  status: 'draft' | 'open' | 'closed' | 'archived'; createdAt: string;
  eligible: number; registered: number; shortlisted: number; selected: number;
  rounds: Array<{ id: string; name: string; kind: string; assignmentId: string | null; scheduledAt: string | null }>;
}
export interface DriveStudent {
  userId: string; name: string | null; email: string; rollNumber: string | null; department: string | null;
  cgpa?: number | null; backlogs?: number | null; eligible: boolean; status: DriveDecision | null; registeredAt: string | null; note: string | null;
}
