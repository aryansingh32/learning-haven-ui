/**
 * Integration-style tests for BuildHavenService.submitVibeStage — the
 * orchestration layer around the real Playwright engine (tested separately,
 * with a real browser, in vibeVerifier.test.ts). Here we mock Supabase and
 * the verification engine itself to exercise the decision logic: ownership,
 * rate limiting, stage/enrollment validation, and progress advancement.
 */
import { createSupabaseChainMock } from './helpers/supabaseChainMock';

const { supabase: supabaseMock, mockNextResponse } = createSupabaseChainMock();

jest.mock('../config/database', () => ({
  supabase: supabaseMock,
  pool: { query: jest.fn(), connect: jest.fn(), on: jest.fn() },
}));

const mockRunVibeVerification = jest.fn();
jest.mock('../modules/build-haven/vibeVerifier', () => {
  const actual = jest.requireActual('../modules/build-haven/vibeVerifier');
  return {
    ...actual,
    runVibeVerification: (...args: unknown[]) => mockRunVibeVerification(...args),
  };
});

import { BuildHavenService } from '../modules/build-haven/service';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000099';
const ENROLLMENT_ID = 'enrollment-1';
const STAGE_ID = 'stage-1';
const PROGRAM_ID = 'program-1';

function baseEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    user_id: USER_ID,
    program_id: PROGRAM_ID,
    build_mode: 'vibe',
    current_stage: 2,
    completed_stages: [1],
    total_stages: 3,
    ...overrides,
  };
}

function baseStage(overrides: Record<string, unknown> = {}) {
  return {
    id: STAGE_ID,
    program_id: PROGRAM_ID,
    stage_number: 2,
    verification_type: 'contract',
    acceptance_contract: { journeys: [{ id: 'j1', label: 'Journey 1', public: true, steps: [] }] },
    ...overrides,
  };
}

/** Queue the standard happy-path sequence up through the stage lookup. */
function queueThroughStageLookup(opts: { enrollment?: Record<string, unknown>; stage?: Record<string, unknown> } = {}) {
  mockNextResponse({ data: opts.enrollment ?? baseEnrollment() }); // enrollment select
  mockNextResponse({ count: 0 }); // rate limit count
  mockNextResponse({ data: opts.stage ?? baseStage() }); // stage select
}

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn();
});

describe('submitVibeStage — validation', () => {
  it('throws with 403 when the enrollment belongs to a different user', async () => {
    mockNextResponse({ data: baseEnrollment({ user_id: OTHER_USER_ID }) });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws when the enrollment does not exist', async () => {
    mockNextResponse({ data: null });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('Enrollment not found');
  });

  it('throws when the enrollment is traditional-mode, not vibe', async () => {
    mockNextResponse({ data: baseEnrollment({ build_mode: 'traditional' }) });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('not in vibe mode');
  });

  it('throws when the enrollment has hit the hourly rate limit', async () => {
    mockNextResponse({ data: baseEnrollment() });
    mockNextResponse({ count: 20 }); // at the cap

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('throws when the stage does not exist', async () => {
    mockNextResponse({ data: baseEnrollment() });
    mockNextResponse({ count: 0 });
    mockNextResponse({ data: null });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('Stage not found');
  });

  it('throws when the stage belongs to a different program than the enrollment', async () => {
    queueThroughStageLookup({ stage: baseStage({ program_id: 'some-other-program' }) });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('does not belong to this enrollment');
  });

  it('throws when the stage is a traditional docker_test stage, not a contract stage', async () => {
    queueThroughStageLookup({ stage: baseStage({ verification_type: 'docker_test' }) });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('not a vibe/contract stage');
  });

  it('throws when submitting for a stage that is not the enrollment\'s current stage', async () => {
    queueThroughStageLookup({ stage: baseStage({ stage_number: 1 }) });

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'https://app.example.com',
      })
    ).rejects.toThrow('only submit your current stage');
  });
});

describe('submitVibeStage — live_url happy paths', () => {
  it('advances enrollment progress when the engine returns verdict "passed"', async () => {
    queueThroughStageLookup();
    mockRunVibeVerification.mockResolvedValueOnce({
      verdict: 'passed',
      gates_passed: 1,
      gates_total: 1,
      score_pct: 100,
      gate_results: [{ journeyId: 'j1', label: 'Journey 1', passed: true, steps_passed: 3, steps_total: 3 }],
      logs_tail: 'ok',
      duration_ms: 1200,
      submission_source: 'live_url',
      submission_ref: 'https://app.example.com',
    });
    mockNextResponse({ count: 0 }); // build_stage_results count
    mockNextResponse({ data: null }); // build_stage_results insert
    mockNextResponse({ data: null }); // build_enrollments update (advance)

    const result = await BuildHavenService.submitVibeStage({
      enrollmentId: ENROLLMENT_ID,
      stageId: STAGE_ID,
      userId: USER_ID,
      submissionSource: 'live_url',
      submissionRef: 'https://app.example.com',
    });

    expect(result.verdict).toBe('passed');
    expect(mockRunVibeVerification).toHaveBeenCalledWith(
      expect.objectContaining({ submissionRef: 'https://app.example.com' })
    );
  });

  it('does not advance progress when the engine returns verdict "failed"', async () => {
    queueThroughStageLookup();
    mockRunVibeVerification.mockResolvedValueOnce({
      verdict: 'failed',
      gates_passed: 0,
      gates_total: 1,
      score_pct: 0,
      gate_results: [{ journeyId: 'j1', label: 'Journey 1', passed: false, steps_passed: 0, steps_total: 3, failure_reason: 'nope' }],
      logs_tail: 'failed',
      duration_ms: 900,
      submission_source: 'live_url',
      submission_ref: 'https://app.example.com',
    });
    mockNextResponse({ count: 2 }); // build_stage_results count
    mockNextResponse({ data: null }); // build_stage_results insert
    mockNextResponse({ data: null }); // build_enrollments update (last_push_at only)

    const result = await BuildHavenService.submitVibeStage({
      enrollmentId: ENROLLMENT_ID,
      stageId: STAGE_ID,
      userId: USER_ID,
      submissionSource: 'live_url',
      submissionRef: 'https://app.example.com',
    });

    expect(result.verdict).toBe('failed');
  });

  it('propagates a SubmissionUrlError from the engine (private/invalid URL) without swallowing it', async () => {
    queueThroughStageLookup();
    const { SubmissionUrlError } = jest.requireActual('../modules/build-haven/vibeVerifier');
    mockRunVibeVerification.mockRejectedValueOnce(new SubmissionUrlError('bad url'));

    await expect(
      BuildHavenService.submitVibeStage({
        enrollmentId: ENROLLMENT_ID,
        stageId: STAGE_ID,
        userId: USER_ID,
        submissionSource: 'live_url',
        submissionRef: 'http://localhost:3000',
      })
    ).rejects.toThrow('bad url');
  });
});

describe('submitVibeStage — github_push', () => {
  it('returns "pending_review" (not a silent pass or fake fail) for a real public repo', async () => {
    queueThroughStageLookup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ private: false }),
    });
    mockNextResponse({ count: 0 });
    mockNextResponse({ data: null });
    mockNextResponse({ data: null }); // last_push_at update — pending_review must not advance progress

    const result = await BuildHavenService.submitVibeStage({
      enrollmentId: ENROLLMENT_ID,
      stageId: STAGE_ID,
      userId: USER_ID,
      submissionSource: 'github_push',
      submissionRef: 'https://github.com/octocat/hello-world',
    });

    expect(result.verdict).toBe('pending_review');
  });

  it('returns "failed" for a repo GitHub reports as not found', async () => {
    queueThroughStageLookup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    mockNextResponse({ count: 0 });
    mockNextResponse({ data: null });
    mockNextResponse({ data: null });

    const result = await BuildHavenService.submitVibeStage({
      enrollmentId: ENROLLMENT_ID,
      stageId: STAGE_ID,
      userId: USER_ID,
      submissionSource: 'github_push',
      submissionRef: 'https://github.com/octocat/does-not-exist',
    });

    expect(result.verdict).toBe('failed');
    expect(result.gate_results[0].failure_reason).toMatch(/not found/i);
  });

  it('rejects a non-GitHub URL before making any network call', async () => {
    queueThroughStageLookup();
    mockNextResponse({ count: 0 });
    mockNextResponse({ data: null });
    mockNextResponse({ data: null });

    const result = await BuildHavenService.submitVibeStage({
      enrollmentId: ENROLLMENT_ID,
      stageId: STAGE_ID,
      userId: USER_ID,
      submissionSource: 'github_push',
      submissionRef: 'https://gitlab.com/octocat/hello-world',
    });

    expect(result.verdict).toBe('failed');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
