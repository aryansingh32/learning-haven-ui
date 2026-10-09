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

/** Languages the server judge can check. */
export const JUDGED_LANGUAGES: SupportedLanguage[] = ['javascript', 'python', 'java'];

export const fetchProblem = (slug: string): Promise<ProblemDetail> => api.get(`/problems/${encodeURIComponent(slug)}`);
export const fetchHints = (id: string): Promise<{ hints: string[] }> => api.get(`/problems/${id}/hints`);
export const fetchSolution = (id: string): Promise<{ solution_code: Record<string, string> | null; solution_explanation: string | null }> =>
  api.get(`/problems/${id}/solution`);
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
    result: {
      status: res.verdict,
      output: res.message ?? '',
      executionTime: res.timeMs,
      testCaseResults: res.verdict === 'Compilation Error' ? undefined : testCaseResults,
      judged: { passed: res.passed, total: res.total },
    },
    xpGained: res.xpGained,
    firstSolve: res.firstSolve,
  };
}
