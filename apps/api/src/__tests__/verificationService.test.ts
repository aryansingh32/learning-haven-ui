/**
 * Regression test for a critical bug: handlePushEvent selected a column
 * (`build_challenge_id`) that does not exist on public.build_enrollments
 * (the real column is `program_id` — see
 * 20260520000001_build_haven_complete.sql). Selecting a nonexistent column
 * makes PostgREST return an error, so `data` came back null on every call
 * and every push silently never enqueued a verification job — the entire
 * traditional-mode "push code, get tested" loop was broken.
 */
import { createSupabaseChainMock } from './helpers/supabaseChainMock';

const { supabase: supabaseMock, mockNextResponse, calls } = createSupabaseChainMock();

jest.mock('../config/database', () => ({
  supabase: supabaseMock,
  pool: { query: jest.fn(), connect: jest.fn(), on: jest.fn() },
}));

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: mockQueueAdd })),
}));
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));

// The global setup mocks VerificationService.bootstrap() to a no-op (other
// suites import app.ts, which triggers real bootstrap() otherwise) — this is
// the one file that actually needs the real implementation under test.
jest.unmock('../modules/execution/services/verification.service');

import { VerificationService } from '../modules/execution/services/verification.service';
import { EventBus } from '../modules/core/events/EventBus';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('VerificationService.handlePushEvent', () => {
  // bootstrap() subscribes to the shared EventBus singleton; calling it more
  // than once would stack duplicate listeners and multiply queue.add() calls.
  beforeAll(() => {
    VerificationService.bootstrap();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
  });

  it('selects program_id (the real column), not build_challenge_id', async () => {
    mockNextResponse({ data: { id: 'enrollment-1', user_id: 'user-1', program_id: 'program-1' } });

    EventBus.publish('github.push_received', {
      repoFullName: 'octocat/hello-world',
      commitHash: 'abc123',
      branch: 'main',
      enrollmentId: 'unused',
    });
    await flush();

    const selectCall = calls.find((c) => c.table === 'build_enrollments' && c.method === 'select');
    expect(selectCall).toBeDefined();
    const selectedColumns = String(selectCall!.args[0]);
    expect(selectedColumns).toContain('program_id');
    expect(selectedColumns).not.toContain('build_challenge_id');
  });

  it('enqueues a build-verification job when an enrollment is found for the repo', async () => {
    mockNextResponse({ data: { id: 'enrollment-1', user_id: 'user-1', program_id: 'program-1' } });

    EventBus.publish('github.push_received', {
      repoFullName: 'octocat/hello-world',
      commitHash: 'abc123',
      branch: 'main',
      enrollmentId: 'unused',
    });
    await flush();

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'verify_build',
      expect.objectContaining({
        repoFullName: 'octocat/hello-world',
        commitHash: 'abc123',
        enrollmentId: 'enrollment-1',
        userId: 'user-1',
        challengeId: 'program-1',
      }),
      expect.anything()
    );
  });

  it('does not enqueue a job (and does not throw) when no enrollment matches the repo', async () => {
    mockNextResponse({ data: null });

    EventBus.publish('github.push_received', {
      repoFullName: 'someone/unrelated-repo',
      commitHash: 'def456',
      branch: 'main',
      enrollmentId: 'unused',
    });
    await flush();

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});
