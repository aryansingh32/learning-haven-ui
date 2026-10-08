import { classifyEvent, normalizePolicy, shouldAutoSubmit, DEFAULT_PROCTORING } from '../proctoring';

describe('classifyEvent', () => {
  it('treats the first time a student leaves the exam as a warning', () => {
    expect(classifyEvent('tab_switch', 0, DEFAULT_PROCTORING)).toBe('warning');
    expect(classifyEvent('tab_switch', 1, DEFAULT_PROCTORING)).toBe('violation');
  });

  it('counts every leave as a violation when warnFirst is off', () => {
    expect(classifyEvent('fullscreen_exit', 0, { ...DEFAULT_PROCTORING, warnFirst: false })).toBe('violation');
  });

  it('only notes clipboard and right-click attempts', () => {
    for (const t of ['copy', 'paste', 'context_menu'] as const) {
      expect(classifyEvent(t, 5, DEFAULT_PROCTORING)).toBe('warning');
    }
  });
});

describe('shouldAutoSubmit', () => {
  it('submits at the violation limit, not before', () => {
    expect(shouldAutoSubmit(2, DEFAULT_PROCTORING)).toBe(false);
    expect(shouldAutoSubmit(3, DEFAULT_PROCTORING)).toBe(true);
  });

  it('never auto-submits without a limit or with proctoring off', () => {
    expect(shouldAutoSubmit(99, { ...DEFAULT_PROCTORING, maxViolations: null })).toBe(false);
    expect(shouldAutoSubmit(99, { ...DEFAULT_PROCTORING, enabled: false })).toBe(false);
  });
});

describe('normalizePolicy', () => {
  it('fills missing settings with defaults', () => {
    expect(normalizePolicy({ maxViolations: 5 })).toEqual({ ...DEFAULT_PROCTORING, maxViolations: 5 });
    expect(normalizePolicy(null)).toEqual(DEFAULT_PROCTORING);
  });

  it('clamps an out-of-range limit', () => {
    expect(normalizePolicy({ maxViolations: 0 }).maxViolations).toBe(3);
    expect(normalizePolicy({ maxViolations: -4 }).maxViolations).toBe(1);
    expect(normalizePolicy({ maxViolations: 1000 }).maxViolations).toBe(50);
    expect(normalizePolicy({ maxViolations: null }).maxViolations).toBeNull();
  });
});
