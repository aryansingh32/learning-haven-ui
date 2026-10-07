import { api } from '@/services/api.svc';

export type QuestionType = 'mcq' | 'msq' | 'nat';
export type AnswerStatus = 'not_visited' | 'visited' | 'answered' | 'marked_for_review' | 'answered_marked';

export interface CatalogTest {
  id: string;
  slug: string;
  title: string;
  durationSeconds: number;
  isSectional: boolean;
  isFree: boolean;
}

export interface CatalogSeries {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  year: number | null;
  isFree: boolean;
  price: number;
  tests: CatalogTest[];
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  series: CatalogSeries[];
}

export interface TestMeta {
  id: string;
  title: string;
  instructions: string | null;
  durationSeconds: number;
  isSectional: boolean;
  isFree: boolean;
  questionCount: number;
}

export interface TestSeriesQuestion {
  id: string;
  questionGroupId: string | null;
  questionType: QuestionType;
  body: string;
  options: { id: string; text: string }[] | null;
  marks: number;
  negativeMarks: number;
  topic: string | null;
  difficulty: string | null;
  sectionId: string | null;
  sortOrder: number;
}

export interface AnswerState {
  question_id: string;
  status: AnswerStatus;
  selected_options: string[] | null;
  nat_value: number | null;
}

export interface StartAttemptResult {
  attemptId: string;
  test: { id: string; title: string; instructions: string | null; isSectional: boolean; sectionTimeLocked: boolean };
  questions: TestSeriesQuestion[];
  startedAt: string;
  expiresAt: string;
  status: 'in_progress' | 'completed';
  answers: AnswerState[];
  score?: number;
  correctCount?: number;
  totalMarks?: number;
}

export interface AttemptResult {
  attemptId: string;
  status: 'in_progress' | 'completed';
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  answers: AnswerState[];
  score: number | null;
  correctCount: number | null;
  totalQuestions: number;
  totalMarks: number;
}

export async function fetchCatalog(): Promise<CatalogCategory[]> {
  return api.get('/test-series/catalog');
}

export async function fetchTestMeta(testId: string): Promise<TestMeta> {
  return api.get(`/test-series/tests/${testId}`);
}

export async function startTestAttempt(testId: string): Promise<StartAttemptResult> {
  return api.post(`/test-series/tests/${testId}/start`);
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  payload: { selectedOptions?: string[] | null; natValue?: number | null; markedForReview?: boolean }
): Promise<{ attemptId: string; questionId: string; status: AnswerStatus }> {
  return api.patch(`/test-series/attempts/${attemptId}/questions/${questionId}`, payload);
}

export async function submitTestAttempt(attemptId: string): Promise<AttemptResult> {
  return api.post(`/test-series/attempts/${attemptId}/submit`);
}

export async function fetchAttempt(attemptId: string): Promise<AttemptResult> {
  return api.get(`/test-series/attempts/${attemptId}`);
}
