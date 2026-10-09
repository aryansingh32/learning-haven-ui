import { describe, expect, it } from 'vitest';
import type { MyAssignment } from '@/services/campus.service';
import { assignmentStatus, sortTodo, timeUntil } from './assignmentStatus';

const base: MyAssignment = {
  id: 'a1', title: 'Week 1', instructions: null, college: 'ABC College', batch: 'CSE 2026',
  opensAt: '2026-10-01T09:00:00Z', closesAt: '2026-10-20T09:00:00Z', durationMinutes: 30,
  state: 'open', maxAttempts: 1, attemptsUsed: 0, latestAttemptId: null, latestStatus: null,
  resultsReleased: false, bestScore: null, totalMarks: null,
  proctoring: { enabled: true, requireFullscreen: true, blockClipboard: true, warnFirst: true, maxViolations: 3 },
};
const make = (o: Partial<MyAssignment>): MyAssignment => ({ ...base, ...o });

describe('assignmentStatus', () => {
  it('offers Start on an open test with attempts left', () => {
    const s = assignmentStatus(base);
    expect(s.bucket).toBe('todo');
    expect(s.action).toEqual({ kind: 'start', attemptNumber: 1 });
  });

  it('offers Resume when an attempt is in progress, even with no attempts left', () => {
    const s = assignmentStatus(make({ attemptsUsed: 1, latestAttemptId: 't1', latestStatus: 'in_progress' }));
    expect(s.action.kind).toBe('resume');
    expect(s.bucket).toBe('todo');
  });

  it('offers a retake while attempts remain', () => {
    const s = assignmentStatus(make({ maxAttempts: 2, attemptsUsed: 1, latestAttemptId: 't1', latestStatus: 'completed' }));
    expect(s.action).toEqual({ kind: 'start', attemptNumber: 2 });
    expect(s.label).toBe('Retake available');
  });

  it('moves a used-up test to Past with a link to the result', () => {
    const s = assignmentStatus(make({ attemptsUsed: 1, latestAttemptId: 't1', latestStatus: 'completed' }));
    expect(s.bucket).toBe('past');
    expect(s.action).toEqual({ kind: 'result', attemptId: 't1' });
    expect(s.label).toBe('Submitted');
  });

  it('shows the score only once results are released', () => {
    const done = { attemptsUsed: 1, latestAttemptId: 't1', latestStatus: 'completed' as const };
    expect(assignmentStatus(make({ ...done, bestScore: 7, totalMarks: 10 })).percent).toBeNull();
    const out = assignmentStatus(make({ ...done, resultsReleased: true, bestScore: 7, totalMarks: 10 }));
    expect(out.percent).toBe(70);
    expect(out.label).toBe('Result out');
  });

  it('never shows a negative percentage (negative marking)', () => {
    const s = assignmentStatus(make({ attemptsUsed: 1, latestAttemptId: 't1', latestStatus: 'completed', resultsReleased: true, bestScore: -2, totalMarks: 10 }));
    expect(s.percent).toBe(0);
  });

  it('marks a closed test without attempts as missed', () => {
    const s = assignmentStatus(make({ state: 'closed' }));
    expect(s.bucket).toBe('past');
    expect(s.action.kind).toBe('missed');
  });

  it('keeps upcoming tests waiting', () => {
    const s = assignmentStatus(make({ state: 'upcoming' }));
    expect(s.bucket).toBe('upcoming');
    expect(s.action).toEqual({ kind: 'wait', opensAt: base.opensAt });
  });
});

describe('sortTodo', () => {
  it('puts in-progress first, then the soonest deadline', () => {
    const later = make({ id: 'later', closesAt: '2026-10-25T00:00:00Z' });
    const sooner = make({ id: 'sooner', closesAt: '2026-10-10T00:00:00Z' });
    const going = make({ id: 'going', closesAt: '2026-10-30T00:00:00Z', latestStatus: 'in_progress' });
    expect(sortTodo([later, sooner, going]).map((a) => a.id)).toEqual(['going', 'sooner', 'later']);
  });

  it('puts a test not yet attempted ahead of a retake that closes sooner', () => {
    const retake = make({ id: 'retake', maxAttempts: 2, attemptsUsed: 1, latestStatus: 'completed', closesAt: '2026-10-10T00:00:00Z' });
    const fresh = make({ id: 'fresh', closesAt: '2026-10-12T00:00:00Z' });
    expect(sortTodo([retake, fresh]).map((a) => a.id)).toEqual(['fresh', 'retake']);
  });
});

describe('timeUntil', () => {
  const now = Date.parse('2026-10-09T10:00:00Z');
  it('formats compactly', () => {
    expect(timeUntil('2026-10-09T10:00:30Z', now)).toBe('30s');
    expect(timeUntil('2026-10-09T10:45:00Z', now)).toBe('45 min');
    expect(timeUntil('2026-10-09T12:05:00Z', now)).toBe('2h 05m');
    expect(timeUntil('2026-10-10T13:00:00Z', now)).toBe('1 day 3h');
    expect(timeUntil('2026-10-14T10:00:00Z', now)).toBe('5 days');
    expect(timeUntil('2026-10-09T09:00:00Z', now)).toBe('now');
  });
});
