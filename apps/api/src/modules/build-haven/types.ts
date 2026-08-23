// =============================================
// Build Haven — Type Definitions
// =============================================

// ---------- Build Challenge (extends Program) ----------
export interface BuildChallenge {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_tagline: string | null;
  thumbnail_url: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  is_free: boolean;
  what_you_build: string | null;
  what_you_learn: string | null;
  why_build: string | null;
  prerequisites_content: string | null;
  supported_languages: string[];
  status: 'draft' | 'beta' | 'live' | 'active' | 'archived';
  program_type: 'build_challenge';
  total_projects: number; // reused as total_stages count
  price_inr: number;
  original_price_inr: number | null;
  testimonials_config?: { auto_slide: boolean; items: any[] } | null;
  // Dual-mode fields
  available_modes: ('traditional' | 'vibe')[];
  default_mode: 'traditional' | 'vibe';
  reference_demo_url: string | null;
  product_contract: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBuildChallengeInput {
  title: string;
  slug: string;
  description?: string;
  short_tagline?: string;
  thumbnail_url?: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  is_free?: boolean;
  what_you_build?: string;
  what_you_learn?: string;
  why_build?: string;
  prerequisites_content?: string;
  supported_languages?: string[];
  status?: 'draft' | 'beta' | 'live' | 'active' | 'archived';
  price_inr?: number;
  original_price_inr?: number;
  duration_days?: number;
  testimonials_config?: { auto_slide: boolean; items: any[] };
  // Dual-mode fields
  available_modes?: ('traditional' | 'vibe')[];
  default_mode?: 'traditional' | 'vibe';
  reference_demo_url?: string;
  product_contract?: string;
}

export interface UpdateBuildChallengeInput extends Partial<CreateBuildChallengeInput> {}

// ---------- Acceptance Contract (Vibe mode) ----------
export interface JourneyStep {
  action:
    | 'goto'
    | 'click'
    | 'fill'
    | 'expect_visible'
    | 'expect_hidden'
    | 'reload'
    | 'wait'
    | 'screenshot';
  /** URL path for goto, CSS/role selector/text for others */
  target?: string;
  /** Value for fill actions */
  value?: string;
  /** Optional step label */
  label?: string;
  /** If true, this step is not shown to learners (hidden grading check) */
  admin_only?: boolean;
}

export interface Journey {
  id: string;
  label: string;
  /** If false, the journey appears in the learner-facing spec */
  public: boolean;
  steps: JourneyStep[];
}

export interface ApiCheck {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  expect_status?: number;
  expect_json_contains?: Record<string, unknown>;
}

export interface VisualCheck {
  id: string;
  viewport?: string;
  assert: 'no_horizontal_scroll' | 'no_console_errors' | 'screenshot_match' | string;
  /** If true, uses AI vision model for evaluation */
  ai_judge?: boolean;
}

export interface AcceptanceContract {
  journeys?: Journey[];
  api_checks?: ApiCheck[];
  visual_checks?: VisualCheck[];
}

// ---------- Build Stage ----------
export interface BuildStage {
  id: string;
  program_id: string;
  stage_number: number;
  /** Short alphanumeric ID (e.g., 'OO8', 'CZ2') for stable URL references */
  short_id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string | null;
  instructions: string | null;
  code_example: string | null;
  hints: string[];
  // Traditional mode
  test_command: string | null;
  docker_test_image: string | null;
  timeout_seconds: number;
  expected_exit_code: number;
  success_criteria: Record<string, unknown>;
  /** Template variable config for randomized test inputs */
  randomization_config: Record<string, unknown> | null;
  // Vibe mode
  verification_type: 'docker_test' | 'contract';
  acceptance_contract: AcceptanceContract;
  // Common
  estimated_minutes: number | null;
  docs_url: string | null;
  concepts_content: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBuildStageInput {
  stage_number: number;
  short_id?: string;
  title: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  description?: string;
  instructions?: string;
  code_example?: string;
  hints?: string[];
  // Traditional
  test_command?: string;
  docker_test_image?: string | null;
  timeout_seconds?: number;
  expected_exit_code?: number;
  success_criteria?: Record<string, unknown>;
  randomization_config?: Record<string, unknown>;
  // Vibe
  verification_type?: 'docker_test' | 'contract';
  acceptance_contract?: AcceptanceContract;
  // Common
  estimated_minutes?: number;
  docs_url?: string;
  concepts_content?: string;
  image_url?: string;
  sort_order?: number;
}

export interface UpdateBuildStageInput extends Partial<CreateBuildStageInput> {}

// ---------- Build Challenge Language ----------
export interface BuildChallengeLanguage {
  id: string;
  program_id: string;
  language: string;
  starter_repo_url: string;
  docker_test_image: string | null;
  setup_instructions: string | null;
  created_at: string;
}

export interface UpsertLanguageInput {
  language: string;
  starter_repo_url: string;
  docker_test_image?: string;
  setup_instructions?: string;
}

// ---------- Build Enrollment ----------
export interface BuildEnrollment {
  id: string;
  user_id: string;
  program_id: string;
  language: string;
  build_mode: 'traditional' | 'vibe';
  current_stage: number;
  completed_stages: number[];
  total_stages: number;
  progress_percentage: number;
  repo_full_name: string | null;
  repo_url: string | null;
  webhook_secret: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
  last_push_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Build Stage Result ----------
export interface BuildStageResult {
  id: string;
  enrollment_id: string;
  stage_id: string;
  user_id: string;
  commit_hash: string | null;
  status: 'pending' | 'running' | 'passed' | 'failed';
  test_output: string | null;
  exit_code: number | null;
  execution_time_ms: number | null;
  attempt_number: number;
  structured_feedback: Record<string, unknown>;
  submission_source: 'github_push' | 'live_url' | 'zip_upload' | 'sandbox_build' | null;
  submission_ref: string | null;
  is_manual_override: boolean;
  overridden_by_admin_id: string | null;
  created_at: string;
  completed_at: string | null;
}

// ---------- Vibe Submission ----------
export interface VibeSubmissionInput {
  stageId: string;
  /** The GitHub repo URL or live deployment URL */
  submissionRef: string;
  submissionSource: 'github_push' | 'live_url';
}

export interface GateResult {
  journeyId: string;
  label: string;
  passed: boolean;
  steps_passed: number;
  steps_total: number;
  failure_step?: string;
  failure_reason?: string;
  screenshot_url?: string | null;
}

export interface VibeVerificationResult {
  verdict: 'passed' | 'partial' | 'failed';
  gates_passed: number;
  gates_total: number;
  score_pct: number;
  gate_results: GateResult[];
  logs_tail: string;
  duration_ms: number;
  submission_source: string;
  submission_ref: string;
}

// ---------- API Responses ----------
export interface BuildChallengeWithDetails extends BuildChallenge {
  stages: BuildStage[];
  languages: BuildChallengeLanguage[];
}

export interface CatalogChallenge extends BuildChallenge {
  languages: BuildChallengeLanguage[];
  stages_count: number;
}
