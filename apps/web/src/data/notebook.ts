import { api } from '@/services/api.svc';

export type NotebookQuizAnswer = {
  question: string;
  options: string[];
  selected_index: number;
  selected_text: string;
  is_correct: boolean;
  correct_option: string | null;
  explanation: string;
};

export type NotebookEntry = {
  chapter_id: string;
  chapter_number: number;
  title: string;
  topic_tag: string | null;
  status: 'LOCKED' | 'LOCKED_PAYWALL' | 'UNLOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  completed_at: string | null;
  notes: string;
  notes_updated_at: string | null;
  quiz_score: number | null;
  quiz_attempts: number;
  quiz_answers: NotebookQuizAnswer[];
  task_response: string | null;
  task_submitted_at: string | null;
};

export type CourseNotebook = {
  course: { id: string; title: string; slug?: string };
  learner_name: string;
  generated_at: string;
  total_chapters: number;
  completed_chapters: number;
  has_content: boolean;
  entries: NotebookEntry[];
};

export type ChapterNotes = {
  content: string;
  updated_at: string | null;
};

export async function fetchCourseNotebook(courseId: string): Promise<CourseNotebook> {
  return api.get(`/notebook/course/${courseId}`);
}

export async function fetchChapterNotes(chapterId: string): Promise<ChapterNotes> {
  return api.get(`/notebook/chapter/${chapterId}/notes`);
}

export async function saveChapterNotes(chapterId: string, content: string): Promise<ChapterNotes> {
  return api.put(`/notebook/chapter/${chapterId}/notes`, { content });
}

export type NotebookExportResult = { url: string; generated_at: string };

export async function exportCourseNotebookPdf(courseId: string): Promise<NotebookExportResult> {
  return api.post(`/notebook/course/${courseId}/export`);
}
