import { api } from '../../../services/api.svc';

/**
 * These chapter-progress endpoints return a bare `{ success, ... }` body rather
 * than the `{ success, data }` envelope that `unwrap()` expects, so they are
 * read directly. Using `unwrap()` here made every *successful* call throw
 * ("API request failed"), which surfaced as a spurious error toast on task
 * submission and stopped `onComplete` from ever firing.
 */

export interface TaskProgressResult {
  success: boolean;
  can_unlock?: boolean;
}

export interface SkipUnlockResult {
  success: boolean;
  tokens_remaining?: number;
  next_chapter?: { id: string; title: string; chapter_number: number } | null;
}

export const learningService = {
  completeTask: (chapterId: string, notes?: string) =>
    api.post(`/chapters/${chapterId}/progress/task`, { notes }) as unknown as Promise<TaskProgressResult>,

  // BH-009: Auto-save draft to server so learner can resume across devices.
  // Called debounced from TaskSection — not on every keystroke.
  saveDraft: (chapterId: string, draft: string) =>
    api.post(`/chapters/${chapterId}/progress/task/draft`, { draft }) as unknown as Promise<{ success: boolean }>,

  skipUnlock: (chapterId: string) =>
    api.post(`/chapters/skip-unlock`, { chapter_id: chapterId }) as unknown as Promise<SkipUnlockResult>,
};
