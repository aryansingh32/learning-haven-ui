import { compareOutputs } from '@repo/assessment-core';
import type { CompareMode, ExecutionResult } from './types';

/** A run on an input the learner typed, e.g. `nums = [3,3], target = 6`, with an optional expected output. */
export interface CustomRunInput { input: string; expected?: string }

const ERROR_PREFIX = /^(Runtime Error|Parse error|Parse Error)\b/;

/**
 * Shape a browser run of one custom test. Without an expected output nothing is
 * compared: a clean run is "Ran" and shows what the function returned.
 */
export function shapeCustomResult(raw: ExecutionResult, custom: CustomRunInput, compareMode: CompareMode = 'exact'): ExecutionResult {
  const tc = raw.testCaseResults?.[0];
  const actual = tc?.actualOutput ?? null;
  const failedToRun = !tc && raw.status !== 'Accepted';
  const error = failedToRun ? (raw.output || raw.status) : actual !== null && ERROR_PREFIX.test(actual) ? actual : null;
  const output = error ? null : actual;
  const expected = custom.expected?.trim() ? custom.expected.trim() : null;

  let status: ExecutionResult['status'];
  if (raw.status === 'Time Limit Exceeded' || raw.status === 'Compilation Error') status = raw.status;
  else if (error) status = 'Runtime Error';
  else if (expected !== null) status = compareOutputs(output ?? '', expected, compareMode) ? 'Accepted' : 'Wrong Answer';
  else status = 'Ran';

  return {
    status,
    output: raw.output,
    executionTime: raw.executionTime,
    ranIn: 'browser',
    custom: { input: custom.input, expected, output, error, matched: expected === null || error ? undefined : status === 'Accepted' },
  };
}

/** KB → "3.4 MB" / "512 KB". */
export function formatMemory(bytes: number | undefined | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
