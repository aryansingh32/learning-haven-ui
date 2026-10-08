// Browser-lockdown proctoring rules. The browser reports events; the
// server decides what counts and when an attempt is auto-submitted, so a
// tampered client can't talk its way out of a violation.

export const PROCTORING_EVENTS = [
  'tab_switch', // document became hidden
  'window_blur', // focus left the exam window (another app, a second screen)
  'fullscreen_exit',
  'copy',
  'paste',
  'context_menu',
] as const;
export type ProctoringEventType = (typeof PROCTORING_EVENTS)[number];

/** Leaving the exam counts against the student; clipboard/menu attempts are blocked and only noted. */
const COUNTS_AS_VIOLATION: Record<ProctoringEventType, boolean> = {
  tab_switch: true,
  window_blur: true,
  fullscreen_exit: true,
  copy: false,
  paste: false,
  context_menu: false,
};

export interface ProctoringPolicy {
  enabled: boolean;
  requireFullscreen: boolean;
  blockClipboard: boolean;
  /** First leave-the-exam event is a warning, not a violation. */
  warnFirst: boolean;
  /** Auto-submit when violations reach this number; null = never. */
  maxViolations: number | null;
}

export const DEFAULT_PROCTORING: ProctoringPolicy = {
  enabled: true,
  requireFullscreen: true,
  blockClipboard: true,
  warnFirst: true,
  maxViolations: 3,
};

export type Severity = 'warning' | 'violation';

/**
 * Severity of the next event, given how many leave-the-exam events the
 * attempt already has (warnings included).
 */
export function classifyEvent(
  type: ProctoringEventType,
  priorLeaveEvents: number,
  policy: ProctoringPolicy
): Severity {
  if (!COUNTS_AS_VIOLATION[type]) return 'warning';
  if (policy.warnFirst && priorLeaveEvents === 0) return 'warning';
  return 'violation';
}

export function countsAsLeave(type: ProctoringEventType): boolean {
  return COUNTS_AS_VIOLATION[type];
}

export function shouldAutoSubmit(violationCount: number, policy: ProctoringPolicy): boolean {
  return policy.enabled && policy.maxViolations !== null && violationCount >= policy.maxViolations;
}

/** Fill gaps in a stored policy with defaults; rejects nonsense values. */
export function normalizePolicy(input: Partial<ProctoringPolicy> | null | undefined): ProctoringPolicy {
  const p = { ...DEFAULT_PROCTORING, ...(input ?? {}) };
  const max = p.maxViolations;
  return {
    enabled: Boolean(p.enabled),
    requireFullscreen: Boolean(p.requireFullscreen),
    blockClipboard: Boolean(p.blockClipboard),
    warnFirst: Boolean(p.warnFirst),
    maxViolations: max === null ? null : Math.max(1, Math.min(50, Math.floor(Number(max) || DEFAULT_PROCTORING.maxViolations!))),
  };
}
