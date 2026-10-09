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
}

export type CodeLanguage = 'python' | 'java' | 'cpp' | 'javascript';
export type CompareMode = 'exact' | 'unordered' | 'unordered_deep';

export interface TestDetail {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  published: boolean;
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
  submitReason: 'manual' | 'timeout' | 'violations' | 'closed' | null;
  submittedAt: string | null;
  gradingPending: boolean;
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
