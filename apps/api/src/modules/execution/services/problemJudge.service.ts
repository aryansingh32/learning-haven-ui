/**
 * Server-side judge for coding problems.
 *
 * The browser's Run button only checks the sample tests; a solve (and its XP)
 * is decided here, against every test including the hidden ones. The judge
 * itself lives in @repo/judge (shared with the Campus API); this file only
 * builds its configuration from the Forge API environment.
 *
 * Execution: Judge0 when JUDGE0_URL is set. In development only, a local
 * runner stands in; production refuses to run code without Judge0.
 */

import { canJudge, judgeSolution as judge, JudgeConfig, JudgeRequest, JudgeResult } from '@repo/judge';
import { env } from '../../../config/env';
import logger from '../../../config/logger';

export {
  declaredJsFunctions, functionHint, JUDGED_LANGUAGES, JudgeUnavailableError, parseMarked,
} from '@repo/judge';
export type { JudgedLanguage, JudgeResult, JudgeTest, TestVerdict, Verdict } from '@repo/judge';

function judgeConfig(): JudgeConfig {
  return {
    judge0Url: env.JUDGE0_URL,
    judge0Token: env.JUDGE0_AUTH_TOKEN,
    languageIds: { javascript: env.JUDGE0_JS_LANGUAGE_ID, python: env.JUDGE0_PYTHON_LANGUAGE_ID, java: env.JUDGE0_JAVA_LANGUAGE_ID, cpp: env.JUDGE0_CPP_LANGUAGE_ID },
    timeoutMs: env.JUDGE0_TIMEOUT_MS,
    environment: env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development',
  };
}

export function isJudgeAvailable(): boolean {
  return canJudge(judgeConfig());
}

export async function judgeSolution(opts: JudgeRequest): Promise<JudgeResult> {
  try {
    return await judge(opts, judgeConfig());
  } catch (err) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause) logger.error('Judge failed', { language: opts.language, error: cause instanceof Error ? cause.message : String(cause) });
    throw err;
  }
}
