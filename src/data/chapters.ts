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

// Mock Data to fix export errors and keep the app running
export const communityFeed = [
  { id: '1', name: 'Rahul S.', action: 'completed Variables & Memory', type: 'completed', time: '2m ago', city: 'Bhopal' },
  { id: '2', name: 'Ananya P.', action: 'started a 5-day streak', type: 'streak', time: '5m ago', city: 'Pune' },
  { id: '3', name: 'Ishaan K.', action: 'shared achievement on LinkedIn', type: 'shared', time: '12m ago', city: 'Indore' },
];

const mockMissions = [
  { id: 'p1_ch1', order: 1, title: 'Variables & Memory', concept: 'Memory addresses and value storage', locked: false, completedSteps: 8, totalSteps: 8, timeMinutes: 15, difficulty: 'easy', icon: 'Brain', reward: { xp: 100, badge: 'Scholar' }, storyIntro: 'Your phone has 128GB of secrets...' },
  { id: 'p1_ch2', order: 2, title: 'Conditionals', concept: 'Decision making logic in code', locked: false, completedSteps: 5, totalSteps: 5, timeMinutes: 20, difficulty: 'easy', icon: 'GitMerge', reward: { xp: 150, badge: 'Logic Master' }, storyIntro: 'Life is just a series of if-else statements...' },
  { id: 'p1_ch3', order: 3, title: 'Loops', concept: 'Automating repetitive tasks', locked: false, completedSteps: 6, totalSteps: 6, timeMinutes: 25, difficulty: 'easy', icon: 'RefreshCw', reward: { xp: 200, badge: 'Automation King' }, storyIntro: 'Imagine sending Happy Birthday to 500 contacts...' },
  { id: 'p1_ch4', order: 4, title: 'Functions', concept: 'Reusable code blocks and scope', locked: false, completedSteps: 3, totalSteps: 8, timeMinutes: 30, difficulty: 'medium', icon: 'LayoutGrid', reward: { xp: 250, badge: 'Architect' }, storyIntro: 'Don\'t repeat yourself. Build a machine...' },
  { id: 'p1_ch5', order: 5, title: 'Arrays', concept: 'Contiguous memory and indexing', locked: true, completedSteps: 0, totalSteps: 8, timeMinutes: 35, difficulty: 'medium', icon: 'Grid', reward: { xp: 300, badge: 'Organizer' }, storyIntro: 'Arrays are just organized dorms for your data...' },
];

export const phaseOne = {
  title: "Phase 1: Programming Foundations",
  description: "Master the basics before DSA touches you. This phase turns you from a complete beginner into someone who can actually write and understand code.",
  missionsCompleted: 3,
  missionsTotal: 8,
  progressPercent: 37,
  missions: mockMissions
};

export const phases = [
  { id: 'phase-0', title: 'Phase 0: Mindset Revolution', subtitle: 'The Zero-to-Dangerous Era', progressPercent: 100, missionsCompleted: 6, missionsTotal: 6, problemsSolved: 12, missions: mockMissions.slice(0, 3) },
  { id: 'phase-1', title: 'Phase 1: Programming Foundations', subtitle: 'The Warrior\'s Arsenal', progressPercent: 37, missionsCompleted: 3, missionsTotal: 8, problemsSolved: 25, missions: mockMissions },
  { id: 'phase-2', title: 'Phase 2: DSA Foundations', subtitle: 'Building Your Weaponry', progressPercent: 0, missionsCompleted: 0, missionsTotal: 12, problemsSolved: 0, missions: [] },
  { id: 'phase-3', title: 'Phase 3: DSA Patterns Mastery', subtitle: 'The Matrix Vision', progressPercent: 0, missionsCompleted: 0, missionsTotal: 10, problemsSolved: 0, missions: [] },
];

export function getMissionById(id: string) {
  const mission = mockMissions.find(m => m.id === id);
  if (mission) {
    return { 
      ...mission, 
      steps: [
        { id: 's1', title: 'Story Hook', type: 'story_hook', storyContent: mission.storyIntro },
        { id: 's2', title: 'Video', type: 'video', videoTitle: 'Watch this', videoDuration: '10m', videoUrl: 'https://www.youtube.com/embed/example', videoNote: 'Focus on basics' },
        { id: 's3', title: 'Complete', type: 'complete' }
      ]
    };
  }
  return null;
}
