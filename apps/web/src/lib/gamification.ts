/** Format streak count with correct singular/plural */
export function formatStreakDays(count: number): string {
  if (count === 1) return '1 Day';
  return `${count} Days`;
}

export type Mission = {
  title: string;
  pathTitle: string;
  progress: number;
  currentStage: string | null;
  nextTask: string;
  reward: { xp: number; label: string };
  continueUrl: string;
  chapterId?: string | null;
  courseId?: string;
  chaptersCompleted?: number;
  chaptersTotal?: number;
  career?: {
    skillsLearned: number;
    projectsBuilt: number;
    interviewReadiness: number;
    salaryBand: string;
  };
  weeklyGoal?: number;
};

export type DailyQuests = {
  date: string;
  quests: Array<{ key: string; label: string; xp: number; completed: boolean }>;
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  rewardXp: number;
  rewardClaimed: boolean;
  bonusXp: number;
};

export type Identity = {
  level: number;
  xp: number;
  streak: number;
  longest_streak: number;
  streak_freeze_count: number;
  identity: { id: string; title: string; minLevel: number; maxLevel: number };
  badges: Array<{ badge_id: string; badge_name: string; badge_emoji: string; earned_at: string }>;
  badge_catalog: Array<{ id: string; name: string; emoji: string; topicTag: string; solveCount: number }>;
};

export type MentorContext = {
  scenario: string;
  message: string;
  actions: Array<{ label: string; action: string; url?: string; prompt?: string }>;
  context: {
    courseTitle: string | null;
    activeChapter: string | null;
    lastCompletedChapter: string | null;
    streak: number;
    daysInactive: number | null;
  };
};
