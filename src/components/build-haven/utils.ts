export type StageProgressStatus = 'locked' | 'not_started' | 'in_progress' | 'completed';

export function stageStatus(
  stageNumber: number,
  enrollment: { current_stage: number; completed_stages?: number[] } | null | undefined
): StageProgressStatus {
  if (!enrollment) return 'not_started';
  const done = enrollment.completed_stages || [];
  if (done.includes(stageNumber)) return 'completed';
  if (stageNumber === enrollment.current_stage) return 'in_progress';
  if (stageNumber < enrollment.current_stage) return 'completed';
  return 'locked';
}

export function normalizeDifficulty(value?: string | null): string {
  if (!value) return '';
  return String(value).replace(/_/g, ' ').trim();
}

export function difficultyTone(difficulty?: string | null): 'easy' | 'medium' | 'hard' | 'neutral' {
  const d = normalizeDifficulty(difficulty).toLowerCase();
  if (d.includes('very easy') || d === 'easy') return 'easy';
  if (d.includes('hard')) return 'hard';
  if (d.includes('medium')) return 'medium';
  return 'neutral';
}
