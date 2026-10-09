import { clip, EDITOR_THEMES, shapeCustomRun } from '../modules/learning/services/practiceRuns';

describe('practice runs', () => {
  const base = { passed: 0, total: 1, timeMs: 5 };

  it('a clean custom run without an expected output is "Ran", with its output', () => {
    const r = shapeCustomRun({ ...base, verdict: 'Wrong Answer', tests: [{ index: 0, passed: false, isSample: true, actual: '[0,1]' }] }, 'nums = [1]', undefined);
    expect(r).toMatchObject({ verdict: 'Ran', passed: 0, total: 0, custom: { output: '[0,1]', expected: null, error: null } });
  });

  it('keeps the verdict when an expected output was given or the code failed', () => {
    expect(shapeCustomRun({ ...base, verdict: 'Accepted', passed: 1, tests: [{ index: 0, passed: true, isSample: true, actual: '1' }] }, 'x = 1', '1').verdict).toBe('Accepted');
    const err = shapeCustomRun({ ...base, verdict: 'Runtime Error', tests: [{ index: 0, passed: false, isSample: true, error: 'TypeError: x' }] }, 'x = 1', undefined);
    expect(err).toMatchObject({ verdict: 'Runtime Error', custom: { output: null, error: 'TypeError: x' } });
    const ce = shapeCustomRun({ ...base, verdict: 'Compilation Error', message: 'line 3: expected ;', tests: [{ index: 0, passed: false, isSample: true }] }, 'x = 1', undefined);
    expect(ce).toMatchObject({ verdict: 'Compilation Error', custom: { error: 'line 3: expected ;' } });
  });

  it('clips long output', () => {
    expect(clip('abcdef', 4)).toBe('abc…');
    expect(clip('abc', 4)).toBe('abc');
    expect(clip(null, 4)).toBeNull();
  });

  it('theme names fit the database format', () => {
    for (const t of EDITOR_THEMES) expect(t).toMatch(/^[a-z0-9-]{1,32}$/);
  });
});
