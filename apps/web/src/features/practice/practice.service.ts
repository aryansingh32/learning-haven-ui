import { api } from '@/services/api.svc';
import type { CompareMode, ExecutionResult, QuestionData, SupportedLanguage } from '@/modules/CodeExecutor';

export interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  companies: string[] | null;
  constraints: string | null;
  time_complexity: string | null;
  space_complexity: string | null;
  is_premium: boolean;
  status: 'solved' | 'tried' | 'revision' | null;
  solved: boolean;
  starter_code: Partial<Record<SupportedLanguage, string>>;
  compare: CompareMode;
  hint_count: number;
  judged: boolean;
  test_count: number;
  sample_tests: Array<{ input: string; output: string; explanation: string | null }>;
}

interface JudgeResponse {
  verdict: ExecutionResult['status'];
  passed: number;
  total: number;
  message?: string;
  timeMs: number;
  tests: Array<{ index: number; passed: boolean; isSample: boolean; actual?: string; error?: string }>;
  xpGained: number;
  firstSolve: boolean;
}

/** Languages the server judge can check (a problem offers those it has starter code for). */
export const JUDGED_LANGUAGES: SupportedLanguage[] = ['javascript', 'python', 'java', 'cpp'];
/** Languages the browser can't run: Run goes to the server (sample tests only). */
export const SERVER_RUN_LANGUAGES: SupportedLanguage[] = ['cpp'];

export const fetchProblem = (slug: string): Promise<ProblemDetail> => api.get(`/problems/${encodeURIComponent(slug)}`);
export const fetchHints = (id: string): Promise<{ hints: string[] }> => api.get(`/problems/${id}/hints`);
export const fetchSolution = (id: string): Promise<{ solution_code: Record<string, string> | null; solution_explanation: string | null }> =>
  api.get(`/problems/${id}/solution`);
export interface SubmissionRecord {
  id: string;
  language: SupportedLanguage;
  code: string;
  verdict: ExecutionResult['status'];
  passed: number;
  total: number;
  time_ms: number | null;
  created_at: string;
}
export const fetchSubmissions = (id: string): Promise<{ submissions: SubmissionRecord[] }> => api.get(`/problems/${id}/submissions`);
export const setProblemStatus = (id: string, status: 'tried' | 'revision' | 'solved') => api.post(`/problems/${id}/status`, { status });

const DIFFICULTY: Record<ProblemDetail['difficulty'], QuestionData['difficulty']> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function toQuestion(p: ProblemDetail): QuestionData {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    difficulty: DIFFICULTY[p.difficulty] ?? 'Easy',
    compareMode: p.compare,
    examples: p.sample_tests.map((t) => ({ input: t.input, output: t.output, explanation: t.explanation ?? undefined })),
    constraints: (p.constraints ?? '').split('\n').map((c) => c.trim()).filter(Boolean),
    starterCode: {
      javascript: p.starter_code.javascript ?? '',
      python: p.starter_code.python ?? '',
      java: p.starter_code.java ?? '',
      cpp: p.starter_code.cpp ?? '',
      c: p.starter_code.c ?? '',
    },
  };
}

export interface JudgeOutcome { result: ExecutionResult; xpGained: number; firstSolve: boolean }

/** Submit to the server judge and shape its answer for the workspace console. */
export async function judgeOnServer(p: ProblemDetail, code: string, language: SupportedLanguage): Promise<JudgeOutcome> {
  let res: JudgeResponse;
  try {
    res = await api.post(`/problems/${p.id}/judge`, { code, language });
  } catch (e) {
    const err = e as Error & { status?: number };
    const message = err.status === 403
      ? 'This problem is part of Forge Pro. Upgrade to submit it.'
      : err.message || 'Could not reach the judge. Your code is saved — try again.';
    return { result: { status: 'Runtime Error', output: message, executionTime: 0 }, xpGained: 0, firstSolve: false };
  }

  return { result: toExecutionResult(p, res, true), xpGained: res.xpGained, firstSolve: res.firstSolve };
}

/** Run on the server against the sample tests only (no solve, no XP). */
export async function runOnServer(p: ProblemDetail, code: string, language: SupportedLanguage): Promise<ExecutionResult> {
  try {
    const res: Omit<JudgeResponse, 'xpGained' | 'firstSolve'> = await api.post(`/problems/${p.id}/run`, { code, language });
    return toExecutionResult(p, res, false);
  } catch (e) {
    const err = e as Error & { status?: number };
    const message = err.status === 403
      ? 'This problem is part of Forge Pro. Upgrade to run it.'
      : err.message || 'Could not run your code right now. Try again in a moment.';
    return { status: 'Runtime Error', output: message, executionTime: 0 };
  }
}

function toExecutionResult(p: ProblemDetail, res: Omit<JudgeResponse, 'xpGained' | 'firstSolve'>, judged: boolean): ExecutionResult {
  let sampleNo = 0;
  let hiddenNo = 0;
  const testCaseResults = res.tests.map((t) => {
    if (t.isSample) {
      const sample = p.sample_tests[sampleNo++];
      return {
        passed: t.passed,
        input: sample?.input ?? '',
        expectedOutput: sample?.output ?? '',
        actualOutput: t.actual ?? t.error ?? '',
        label: `Example ${sampleNo}`,
      };
    }
    hiddenNo += 1;
    return { passed: t.passed, hidden: true, error: t.error, label: `Hidden test ${hiddenNo}`, input: '', expectedOutput: '', actualOutput: '' };
  });

  return {
    status: res.verdict,
    output: res.message ?? '',
    executionTime: res.timeMs,
    testCaseResults: res.verdict === 'Compilation Error' ? undefined : testCaseResults,
    ...(judged ? { judged: { passed: res.passed, total: res.total } } : {}),
  };
}

export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  companies: string[] | null;
  is_premium: boolean;
  status: 'solved' | 'tried' | 'revision' | null;
}
export interface DailyProblem {
  date: string;
  problem: Pick<ProblemListItem, 'id' | 'slug' | 'title' | 'difficulty' | 'topic' | 'companies'> | null;
  solved: boolean;
  solved_today: boolean;
}
export const fetchDailyProblem = (): Promise<DailyProblem> => api.get('/problems/daily');
export const fetchProblemCompanies = (): Promise<{ companies: Array<{ name: string; count: number }> }> => api.get('/problems/companies');
export function findProblems(f: { search?: string; company?: string; difficulty?: string }): Promise<{ problems: ProblemListItem[]; pagination: { total: number } }> {
  const q = new URLSearchParams({ limit: '50' });
  if (f.search) q.set('search', f.search);
  if (f.company) q.set('company', f.company);
  if (f.difficulty) q.set('difficulty', f.difficulty);
  return api.get(`/problems?${q.toString()}`);
}
