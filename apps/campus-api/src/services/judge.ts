// Code judging for coding questions, through the shared @repo/judge package.

import { canJudge, functionHint, judgeSolution, JudgeConfig, JudgedLanguage, JudgeResult, JudgeTest, JUDGED_LANGUAGES } from '@repo/judge';
import { CompareMode, isCompareMode } from '@repo/assessment-core';
import { env } from '../env';

export { JUDGED_LANGUAGES, JudgeUnavailableError } from '@repo/judge';
export type { JudgedLanguage, JudgeResult } from '@repo/judge';

export type StarterCode = Partial<Record<JudgedLanguage, string>>;

export interface CodingSpec {
  starterCode: StarterCode;
  judgeConfig: { compare?: string };
}

export function judgeConfig(): JudgeConfig {
  return {
    judge0Url: env.JUDGE0_URL,
    judge0Token: env.JUDGE0_AUTH_TOKEN,
    languageIds: { javascript: env.JUDGE0_JS_LANGUAGE_ID, python: env.JUDGE0_PYTHON_LANGUAGE_ID, java: env.JUDGE0_JAVA_LANGUAGE_ID, cpp: env.JUDGE0_CPP_LANGUAGE_ID },
    timeoutMs: env.JUDGE0_TIMEOUT_MS,
    environment: env.NODE_ENV,
  };
}

export const judgeAvailable = () => canJudge(judgeConfig());

/** Languages a question accepts: the ones it has starter code for. */
export function languagesOf(starter: StarterCode): JudgedLanguage[] {
  return JUDGED_LANGUAGES.filter((l) => typeof starter[l] === 'string');
}

export function compareOf(spec: CodingSpec): CompareMode {
  const c = spec.judgeConfig?.compare;
  return c && isCompareMode(c) ? c : 'exact';
}

export function judgeCode(spec: CodingSpec, code: string, language: JudgedLanguage, tests: JudgeTest[]): Promise<JudgeResult> {
  return judgeSolution(
    { code, language, tests, compare: compareOf(spec), hint: functionHint(language, spec.starterCode[language]) },
    judgeConfig()
  );
}
