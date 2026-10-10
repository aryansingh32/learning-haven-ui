import { api } from '@/services/api.svc';

// ── Highlights ────────────────────────────────────────────────────────────
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';
export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export type ChapterHighlight = {
  id: string;
  chapter_id: string;
  step_id: string | null;
  text: string;
  prefix: string;
  suffix: string;
  start_offset: number;
  color: HighlightColor;
  created_at: string;
};

export type NewHighlight = Pick<ChapterHighlight, 'text' | 'prefix' | 'suffix' | 'start_offset' | 'color' | 'step_id'>;

export function fetchChapterHighlights(chapterId: string): Promise<{ available: boolean; highlights: ChapterHighlight[] }> {
  return api.get(`/highlights/chapter/${chapterId}`);
}

export function createHighlight(chapterId: string, h: NewHighlight): Promise<{ highlight: ChapterHighlight }> {
  return api.post(`/highlights/chapter/${chapterId}`, h);
}

export function recolorHighlight(id: string, color: HighlightColor): Promise<{ highlight: ChapterHighlight }> {
  return api.patch(`/highlights/${id}`, { color });
}

export function deleteHighlight(id: string): Promise<{ success: boolean }> {
  return api.delete(`/highlights/${id}`);
}

// ── Discussions ───────────────────────────────────────────────────────────
export type DiscussionPost = {
  id: string;
  parent_id: string | null;
  author_name: string;
  mine: boolean;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
  hidden: boolean;
  hidden_reason: string | null;
  reported_by_me: boolean;
  open_reports?: number;
  replies: DiscussionPost[];
};

export type ChapterDiscussion = { can_moderate: boolean; posts: DiscussionPost[] };
export type ReportReason = 'spam' | 'abuse' | 'off_topic' | 'other';

export function fetchDiscussion(chapterId: string): Promise<ChapterDiscussion> {
  return api.get(`/discussion/chapter/${chapterId}`);
}

export function createPost(chapterId: string, body: string, parentId?: string | null): Promise<{ id: string }> {
  return api.post(`/discussion/chapter/${chapterId}`, { body, parent_id: parentId ?? null });
}

export function editPost(id: string, body: string): Promise<{ id: string }> {
  return api.patch(`/discussion/posts/${id}`, { body });
}

export function deletePost(id: string): Promise<{ id: string }> {
  return api.delete(`/discussion/posts/${id}`);
}

export function reportPost(id: string, reason: ReportReason, details?: string): Promise<{ id: string }> {
  return api.post(`/discussion/posts/${id}/report`, { reason, details });
}

export function moderatePost(id: string, hidden: boolean, reason?: string): Promise<{ id: string; hidden: boolean }> {
  return api.post(`/discussion/posts/${id}/moderate`, { hidden, reason });
}

// ── Course gates (prerequisites, drip) ────────────────────────────────────
export type CoursePrerequisite = { course_id: string; title: string; slug: string; total: number; done: number; completed: boolean };

export type ChapterGate =
  | { code: 'PREREQUISITES'; message: string; prerequisites: CoursePrerequisite[] }
  | { code: 'DRIP'; message: string; available_at: string };

/** "15 Oct 2026" in India time. */
export function formatUnlockDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** Message from an API error (axios-style or the api.svc wrapper). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; data?: { error?: string }; message?: string } | null;
  return e?.data?.error || e?.response?.data?.error || e?.message || fallback;
}
