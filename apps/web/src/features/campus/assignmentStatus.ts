import type { MyAssignment } from '@/services/campus.service';

export type AssignmentBucket = 'todo' | 'upcoming' | 'past';

export type AssignmentAction =
  | { kind: 'resume' }
  | { kind: 'start'; attemptNumber: number }
  | { kind: 'result'; attemptId: string }
  | { kind: 'wait'; opensAt: string }
  | { kind: 'missed' };

export interface AssignmentStatus {
  bucket: AssignmentBucket;
  action: AssignmentAction;
  /** Short label for the status pill. */
  label: string;
  tone: 'primary' | 'warning' | 'success' | 'muted' | 'danger';
  /** Percentage score when results are out, else null. */
  percent: number | null;
}

/** What a student can do with an assignment right now, and where it belongs on the page. */
export function assignmentStatus(a: MyAssignment): AssignmentStatus {
  const percent = a.resultsReleased && a.bestScore !== null && a.totalMarks
    ? Math.max(0, Math.round((a.bestScore / a.totalMarks) * 100))
    : null;
  const inProgress = a.latestStatus === 'in_progress';
  const attemptsLeft = a.maxAttempts - a.attemptsUsed;

  if (a.state === 'upcoming') {
    return { bucket: 'upcoming', action: { kind: 'wait', opensAt: a.opensAt }, label: 'Upcoming', tone: 'muted', percent };
  }

  if (a.state === 'open') {
    if (inProgress) {
      return { bucket: 'todo', action: { kind: 'resume' }, label: 'In progress', tone: 'warning', percent };
    }
    if (attemptsLeft > 0) {
      return {
        bucket: 'todo',
        action: { kind: 'start', attemptNumber: a.attemptsUsed + 1 },
        label: a.attemptsUsed === 0 ? 'Not started' : 'Retake available',
        tone: 'primary',
        percent,
      };
    }
  }

  // Open with no attempts left, or closed.
  if (a.latestAttemptId && a.attemptsUsed > 0) {
    return {
      bucket: 'past',
      action: { kind: 'result', attemptId: a.latestAttemptId },
      label: a.resultsReleased ? 'Result out' : 'Submitted',
      tone: 'success',
      percent,
    };
  }
  return { bucket: 'past', action: { kind: 'missed' }, label: 'Missed', tone: 'danger', percent };
}

/** "2h 05m", "3 days", "45s" — compact time left until a date. */
export function timeUntil(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 2) return `${d} days`;
  if (d === 1) return `1 day ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

/** Most urgent first: in progress, then not yet attempted, then retakes; soonest deadline within each. */
export function sortTodo(list: MyAssignment[]): MyAssignment[] {
  const rank = (a: MyAssignment) => (a.latestStatus === 'in_progress' ? 0 : a.attemptsUsed === 0 ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime());
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}
