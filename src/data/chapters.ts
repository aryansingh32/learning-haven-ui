import { api } from '@/services/api.svc';

export type StepType =
  | 'story_hook'
  | 'video'
  | 'doc'
  | 'visualizer'
  | 'practice'
  | 'quiz'
  | 'task'
  | 'micro_revision'
  | 'complete';

export type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type PracticeProblem = {
  id: string;
  prompt: string;
  input_type?: 'text' | 'code' | 'mcq';
  buggy_code?: string;
  expected_fix?: string;
  expected_output?: string;
};

export type StepContent = {
  story?: string;
  youtube_url?: string;
  title?: string;
  channel?: string;
  duration_min?: number;
  focus_note?: string;
  backup_urls?: string[];
  doc_md?: string;
  visualizer?: {
    url?: string;
    task?: string;
    notes?: string;
  };
  practice_problems?: PracticeProblem[];
  quiz_questions?: QuizQuestion[];
  pass_rule?: string;
  task_prompt?: string;
  buggy_code?: string;
  connection_map?: string;
  recall_questions?: string[];
  identity_affirmation?: string;
  completion_celebration?: {
    message?: string;
    linkedin_card_text?: string;
  };
  streak_reminder?: string;
  reward_chest?: {
    type: 'random' | 'fixed';
    rewards: string[];
  };
};

export type ChapterStep = {
  id: string;
  step_number: number;
  type: StepType;
  title: string;
  content: StepContent;
};

export type Chapter = {
  id: string;
  roadmap_id: string;
  chapter_number: number;
  title: string;
  topic_tag?: string;
  difficulty?: string;
  est_minutes?: number;
  story_hook?: string;
  whatsapp_msg?: string;
  steps: ChapterStep[];
};

export type ChapterProgress = {
  id: string;
  status: 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  quiz_score?: number;
  quiz_attempts?: number;
  tasks_completed?: number;
  steps_completed?: string[];
  unlocked_at?: string;
  completed_at?: string;
};

export type Phase = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  type?: string;
  difficulty_level?: string;
  duration_days?: number;
  is_premium?: boolean;
  is_published?: boolean;
  meta?: {
    order?: number;
    est_hours?: number;
    icon?: string;
    phase_consolidation?: {
      title?: string;
      mental_map?: string;
      self_rating?: string[];
      linkedin_card?: {
        headline?: string;
        subhead?: string;
        bullets?: string[];
      };
    };
  };
};

export type ChapterWithProgressResponse = {
  chapter: Chapter;
  content: {
    steps: ChapterStep[];
  };
  progress: ChapterProgress;
};

export async function fetchPhases() {
  return api.get('/roadmaps');
}

export async function fetchPhaseChapters(roadmapId: string) {
  return api.get(`/roadmaps/${roadmapId}/chapters`);
}

export async function fetchChapterWithProgress(chapterId: string): Promise<ChapterWithProgressResponse> {
  return api.get(`/chapters/${chapterId}`);
}
