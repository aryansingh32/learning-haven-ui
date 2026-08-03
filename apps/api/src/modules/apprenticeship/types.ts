// =============================================
// Apprenticeship Platform — Type Definitions
// =============================================

// ---------- Programs ----------
export interface Program {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_days: number;
  price_inr: number;
  original_price_inr: number | null;
  tech_stack: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  total_projects: number;
  learning_paths: string[];
  max_enrollments: number | null;
  enrolled_count: number;
  avg_completion_rate: number;
  status: 'draft' | 'active' | 'archived';
  certificate_preview_url: string | null;
  community_size: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProgramInput {
  title: string;
  slug: string;
  description?: string;
  duration_days: number;
  price_inr: number;
  original_price_inr?: number;
  tech_stack?: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  total_projects?: number;
  learning_paths?: string[];
  max_enrollments?: number;
  status?: 'draft' | 'active' | 'archived';
  certificate_preview_url?: string;
}

export interface UpdateProgramInput extends Partial<CreateProgramInput> {}

// ---------- Projects ----------

export interface GuideStep {
  step_number: number;
  title: string;
  description: string;
  code_snippets: string[];
  verification_hints?: string[];
}

export interface TraditionalGuide {
  steps: GuideStep[];
}

export interface AIGuide {
  overview: string;
  recommended_prompts: { phase: string; prompt: string; expected_outcome: string }[];
  best_practices: string[];
}

export interface VerificationRequirements {
  required_endpoints: string[];
  required_tests: number;
  deployment_required: boolean;
}

export interface HelpfulResource {
  title: string;
  url: string;
}

export interface Project {
  id: string;
  program_id: string;
  project_number: number;
  title: string;
  slug: string;
  description: string | null;
  estimated_hours: number | null;
  traditional_guide: TraditionalGuide | null;
  ai_guide: AIGuide | null;
  starter_repo_url: string | null;
  reference_solution_url: string | null;
  helpful_resources: HelpfulResource[];
  verification_mode: 'automated' | 'manual';
  verification_requirements: VerificationRequirements | null;
  docker_test_image: string | null;
  unlock_condition: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  project_number: number;
  title: string;
  slug: string;
  description?: string;
  estimated_hours?: number;
  traditional_guide?: TraditionalGuide;
  ai_guide?: AIGuide;
  starter_repo_url?: string;
  reference_solution_url?: string;
  helpful_resources?: HelpfulResource[];
  verification_mode?: 'automated' | 'manual';
  verification_requirements?: VerificationRequirements;
  docker_test_image?: string;
  sort_order?: number;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {}

// ---------- Enrollments ----------

export interface Enrollment {
  id: string;
  user_id: string;
  program_id: string;
  payment_id: string | null;
  referral_code: string | null;
  learning_path: 'traditional' | 'ai_assisted';
  enrolled_at: string;
  expires_at: string;
  current_project_number: number;
  completed_projects: number;
  total_projects: number;
  progress_percentage: number;
  certificate_issued: boolean;
  certificate_id: string | null;
  status: 'active' | 'expired' | 'completed' | 'revoked';
  discord_invited: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Project Progress ----------

export interface ProjectProgress {
  id: string;
  enrollment_id: string;
  project_id: string;
  user_id: string;
  status: 'locked' | 'available' | 'in_progress' | 'passed' | 'skipped';
  github_repo_full_name: string | null;
  github_repo_url: string | null;
  webhook_secret: string | null;
  started_at: string | null;
  passed_at: string | null;
  attempts_count: number;
  best_code_quality_score: number | null;
  total_xp_earned: number;
  created_at: string;
  updated_at: string;
}

// ---------- Submissions ----------

export interface FailedTest {
  name: string;
  error: string;
  expected: string;
  actual: string;
}

export interface Submission {
  id: string;
  enrollment_id: string;
  project_progress_id: string;
  user_id: string;
  project_id: string;
  github_repo_full_name: string | null;
  commit_hash: string | null;
  live_url: string | null;
  learning_path: string | null;
  attempt_number: number;
  verification_status: 'pending' | 'testing' | 'passed' | 'failed' | 'manual_review' | 'manual_passed' | 'manual_failed';
  total_tests: number | null;
  passed_tests: number | null;
  failed_tests: FailedTest[] | null;
  code_quality_score: number | null;
  security_issues: object | null;
  performance_score: number | null;
  execution_time_ms: number | null;
  console_output_tail: string | null;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  code_quality_override: number | null;
  xp_bonus: number;
  reviewed_at: string | null;
  submitted_at: string;
  testing_started_at: string | null;
  verified_at: string | null;
  xp_awarded: number;
  flagged_for_review: boolean;
  flag_reason: string | null;
}

// ---------- Test Stages ----------

export interface TestStage {
  id: string;
  submission_id: string;
  stage_number: number;
  stage_name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  tests_in_stage: number | null;
  passed_in_stage: number | null;
  failed_details: object | null;
  xp_for_stage: number;
  started_at: string | null;
  completed_at: string | null;
}

// ---------- GitHub Connection ----------

export interface GitHubConnection {
  id: string;
  user_id: string;
  github_username: string;
  github_user_id: number;
  access_token: string;
  token_scopes: string[];
  connected_at: string;
  last_used_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
}

// ---------- Certificates ----------

export interface Certificate {
  id: string;
  enrollment_id: string;
  user_id: string;
  program_id: string;
  verification_code: string;
  recipient_name: string;
  final_grade: 'Distinction' | 'Merit' | 'Pass';
  avg_code_quality_score: number | null;
  projects_completed: number;
  certificate_url: string | null;
  pdf_url: string | null;
  social_share_image_url: string | null;
  issued_at: string;
}

// ---------- Community ----------

export interface Post {
  id: string;
  program_id: string;
  project_id: string | null;
  user_id: string;
  content: string;
  attachments: object | null;
  upvotes: number;
  replies_count: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface PostReply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  upvotes: number;
  created_at: string;
}

// ---------- Events ----------

export interface ApprenticeshipEvent {
  id: string;
  user_id: string | null;
  session_id: string;
  event_type: string;
  event_category: string;
  event_data: object | null;
  page_url: string | null;
  referrer_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country_code: string | null;
  duration_ms: number | null;
  enrollment_id: string | null;
  project_id: string | null;
  submission_id: string | null;
  created_at: string;
}

// ---------- Coupons ----------

export interface Coupon {
  id: string;
  code: string;
  program_id: string | null;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  per_user_limit: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ---------- API Response Types ----------

export interface ProgramWithProjects extends Program {
  projects: Project[];
}

export interface ProgramListResponse {
  programs: Program[];
  total: number;
}

export interface AdminProgramListResponse {
  programs: Program[];
  total: number;
}
