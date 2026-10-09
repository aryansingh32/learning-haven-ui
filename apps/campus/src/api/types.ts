export type Role = 'owner' | 'admin' | 'placement_officer' | 'faculty' | 'evaluator' | 'invigilator' | 'student';

export type Permission =
  | 'org.manage' | 'org.billing' | 'members.manage' | 'members.view' | 'batches.manage'
  | 'content.create' | 'assessments.create' | 'assessments.grade' | 'assessments.invigilate'
  | 'reports.view' | 'reports.export' | 'records.view';

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
}

export interface Me {
  claimed: number;
  memberships: Membership[];
  isPlatformAdmin: boolean;
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

export interface Department { id: string; name: string; code: string }

export interface Batch {
  id: string;
  name: string;
  academicYear: string | null;
  graduationYear: number | null;
  status: 'active' | 'archived';
  departmentId: string | null;
  departmentName: string | null;
  studentCount: number;
}

export interface Member {
  userId: string;
  role: Role;
  status: 'active' | 'suspended' | 'invited';
  rollNumber: string | null;
  department: string | null;
  batches: string[];
  fullName?: string | null;
  email?: string;
}

export interface RosterIssue { line: number; message: string }
export interface RosterPreview {
  errors: RosterIssue[];
  summary: { valid: number; new: number; alreadyRegistered: number; invalid: number };
  rows: Array<{ line: number; email: string; fullName: string | null; rollNumber: string | null; department: string | null; batch: string | null; role: Role; existing: 'pending' | 'claimed' | null }>;
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
  source: 'college' | 'forge';
  questionCount: number;
}

export interface Question {
  id: string;
  type: 'mcq' | 'msq' | 'nat' | 'coding';
  body: string;
  options: Array<{ id: string; text: string }> | null;
  correctOptions: string[] | null;
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
  review: ReviewOutcome | null;
}

export interface Results {
  assignment: { id: string; title: string; batch: string };
  summary: {
    assigned: number; submitted: number; notAttempted: number;
    averagePercent: number | null; highestPercent: number | null; lowestPercent: number | null; flagged: number;
    gradingPending: number;
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
  batchId: string; batchName: string; courseId: string; courseTitle: string | null; chapters: number; wholeCourse: boolean;
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
