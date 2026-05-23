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
}

export interface UpdateBuildChallengeInput extends Partial<CreateBuildChallengeInput> {}

// ---------- Build Stage ----------
export interface BuildStage {
  id: string;
  program_id: string;
  stage_number: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string | null;
  instructions: string | null;
  code_example: string | null;
  hints: string[];
  test_command: string | null;
  docker_test_image: string | null;
  timeout_seconds: number;
  expected_exit_code: number;
  success_criteria: Record<string, unknown>;
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
  title: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  description?: string;
  instructions?: string;
  code_example?: string;
  hints?: string[];
  test_command?: string;
  docker_test_image?: string | null;
  timeout_seconds?: number;
  expected_exit_code?: number;
  success_criteria?: Record<string, unknown>;
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
  created_at: string;
  completed_at: string | null;
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
