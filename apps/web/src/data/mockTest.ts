import { api } from '@/services/api.svc';

export type MockTestQuestion = {
  question: string;
  options: string[];
  chapter_title: string;
};

export type MockTestStartResult = {
  test_id: string;
  started_at: string;
  duration_seconds: number;
  course_title: string;
  questions: MockTestQuestion[];
};

export type MockTestAnswerResult = {
  question: string;
  options: string[];
  selected_index: number;
  selected_text: string;
  is_correct: boolean;
  correct_option: string | null;
  explanation: string;
  chapter_title: string;
};

export type MockTestSubmitResult = {
  test_id: string;
  score_percent: number;
  correct_count: number;
  total_questions: number;
  answers: MockTestAnswerResult[];
  submitted_at: string;
};

export async function startMockTest(courseId: string): Promise<MockTestStartResult> {
  return api.post(`/mock-test/course/${courseId}/start`);
}

export async function submitMockTest(
  testId: string,
  answers: Array<{ question_index: number; selected_index: number }>
): Promise<MockTestSubmitResult> {
  return api.post(`/mock-test/${testId}/submit`, { answers });
}

export async function fetchLatestMockTest(courseId: string): Promise<MockTestSubmitResult | null> {
  return api.get(`/mock-test/course/${courseId}/latest`);
}
