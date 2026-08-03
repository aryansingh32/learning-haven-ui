import { api, unwrap } from '../../../services/api.svc';

export const learningService = {
  completeTask: (chapterId: string, notes?: string) =>
    unwrap<void>(api.post(`/chapters/${chapterId}/progress/task`, { notes })),
    
  skipUnlock: (chapterId: string) =>
    unwrap<void>(api.post(`/chapters/skip-unlock`, { chapter_id: chapterId })),
};
