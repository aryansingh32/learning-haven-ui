import { pool } from '../../../config/database';

jest.mock('../../../config/database', () => ({
  pool: { query: jest.fn() },
}));

import { TestSeriesService } from '../services/testseries.service';

const mockQuery = pool.query as jest.Mock;

const QUESTION_ROW = {
  id: 'q1',
  question_group_id: null,
  question_type: 'mcq',
  body: 'What is 2+2?',
  options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }],
  correct_options: ['b'],
  nat_answer: null,
  nat_tolerance: '0',
  marks: '2',
  negative_marks: '0.67',
  topic: 'arithmetic',
  difficulty: 'easy',
  section_id: null,
  sort_order: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TestSeriesService — server-authoritative expiry', () => {
  it('rejects an autosave once the attempt has expired, even though the write is attempted', async () => {
    const pastAttempt = {
      id: 'attempt-1',
      user_id: 'user-1',
      test_id: 'test-1',
      status: 'in_progress',
      expires_at: new Date(Date.now() - 60_000).toISOString(), // expired a minute ago
      answers: [{ question_id: 'q1', status: 'not_visited', selected_options: null, nat_value: null }],
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [pastAttempt] }) // SELECT attempt
      .mockResolvedValueOnce({ rows: [QUESTION_ROW] }) // getTestQuestions (inside finalize)
      .mockResolvedValueOnce({ rows: [{ ...pastAttempt, status: 'completed', score: '0', correct_count: 0, total_marks: '2' }] }); // UPDATE -> completed

    await expect(
      TestSeriesService.autosaveAnswer('user-1', 'attempt-1', 'q1', { selectedOptions: ['b'] })
    ).rejects.toThrow('Attempt already finalized');

    // The finalize path was exercised (question fetch + completing UPDATE) --
    // the late answer was never persisted as a live autosave.
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('scores a manual submit using only the server-persisted answers', async () => {
    const inProgressAttempt = {
      id: 'attempt-2',
      user_id: 'user-1',
      test_id: 'test-1',
      status: 'in_progress',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      answers: [{ question_id: 'q1', status: 'answered', selected_options: ['b'], nat_value: null }], // correct
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [inProgressAttempt] }) // SELECT attempt
      .mockResolvedValueOnce({ rows: [QUESTION_ROW] }) // getTestQuestions
      .mockResolvedValueOnce({
        rows: [{ ...inProgressAttempt, status: 'completed', score: '2', correct_count: 1, total_marks: '2' }],
      }); // UPDATE

    const result = await TestSeriesService.submitAttempt('user-1', 'attempt-2');

    expect(result.status).toBe('completed');
    expect(result.score).toBe(2);
    expect(result.correctCount).toBe(1);

    // Confirm the UPDATE was called with the score computed server-side (2),
    // not anything a client could have supplied -- submitAttempt takes no
    // answer payload at all.
    const updateCall = mockQuery.mock.calls[2];
    expect(updateCall[0]).toMatch(/UPDATE public\.test_attempts/);
    expect(updateCall[1]).toEqual(['attempt-2', 2, 1, 2]);
  });

  it('is idempotent: submitting an already-completed attempt just returns it', async () => {
    const completedAttempt = {
      id: 'attempt-3',
      user_id: 'user-1',
      test_id: 'test-1',
      status: 'completed',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      submitted_at: new Date().toISOString(),
      answers: [],
      score: '2',
      correct_count: 1,
      total_questions: 1,
      total_marks: '2',
    };

    mockQuery.mockResolvedValueOnce({ rows: [completedAttempt] }); // SELECT attempt only

    const result = await TestSeriesService.submitAttempt('user-1', 'attempt-3');

    expect(result.status).toBe('completed');
    expect(result.score).toBe(2);
    expect(mockQuery).toHaveBeenCalledTimes(1); // no re-scoring, no UPDATE
  });
});

describe('TestSeriesService — attempt resume', () => {
  it('resumes an existing in-progress attempt instead of creating a duplicate', async () => {
    const test = {
      id: 'test-1',
      title: 'Sample Test',
      instructions: 'Answer all questions.',
      duration_seconds: 1800,
      is_sectional: false,
      section_time_locked: false,
      is_published: true,
      release_at: null,
      test_is_free: true,
      series_is_free: true,
    };
    const existingAttempt = {
      id: 'attempt-4',
      user_id: 'user-1',
      test_id: 'test-1',
      status: 'in_progress',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      answers: [{ question_id: 'q1', status: 'not_visited', selected_options: null, nat_value: null }],
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [test] }) // SELECT test
      .mockResolvedValueOnce({ rows: [existingAttempt] }) // SELECT existing in-progress attempt
      .mockResolvedValueOnce({ rows: [QUESTION_ROW] }); // getTestQuestions

    const result = await TestSeriesService.startAttempt('user-1', 'test-1');

    expect(result.attemptId).toBe('attempt-4');
    expect(result.status).toBe('in_progress');
    // No INSERT was issued -- exactly the 3 SELECTs above, nothing more.
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });
});

describe('TestSeriesService — paywall guard (no purchase/entitlement layer exists yet)', () => {
  it('refuses to start a test that is not free and whose series is not free either', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'test-paid',
          title: 'Paid Test',
          instructions: null,
          duration_seconds: 1800,
          is_sectional: false,
          section_time_locked: false,
          is_published: true,
          release_at: null,
          test_is_free: false,
          series_is_free: false,
        },
      ],
    });

    await expect(TestSeriesService.startAttempt('user-1', 'test-paid')).rejects.toThrow(
      'This test requires purchase, which is not available yet'
    );
    // Refused before ever looking up an existing attempt or the question bank.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('allows starting when the individual test is marked free even if its series is not', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'test-free-sample',
            title: 'Free Sample',
            instructions: null,
            duration_seconds: 1800,
            is_sectional: false,
            section_time_locked: false,
            is_published: true,
            release_at: null,
            test_is_free: true,
            series_is_free: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // no existing in-progress attempt
      .mockResolvedValueOnce({ rows: [QUESTION_ROW] }) // getTestQuestions
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'attempt-new',
            user_id: 'user-1',
            test_id: 'test-free-sample',
            status: 'in_progress',
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 1800_000).toISOString(),
            answers: [],
          },
        ],
      }); // INSERT new attempt

    const result = await TestSeriesService.startAttempt('user-1', 'test-free-sample');
    expect(result.status).toBe('in_progress');
  });
});
