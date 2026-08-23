import { api, unwrap } from '../../../services/api.svc';

export const learningService = {
  completeTask: (chapterId: string, notes?: string) =>
    unwrap<void>(api.post(`/chapters/${chapterId}/progress/task`, { notes })),

  // BH-009: Auto-save draft to server so learner can resume across devices.
  // Called debounced from TaskSection — not on every keystroke.
  saveDraft: (chapterId: string, draft: string) =>
    unwrap<void>(api.post(`/chapters/${chapterId}/progress/task/draft`, { draft })),

  skipUnlock: (chapterId: string) =>
    unwrap<void>(api.post(`/chapters/skip-unlock`, { chapter_id: chapterId })),
};
