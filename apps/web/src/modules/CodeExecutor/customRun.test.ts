import { formatMemory, shapeCustomResult } from './customRun';
import { EDITOR_THEMES, isKnownTheme } from './editorThemes';
import { CLANG_STYLE, FORMATTABLE_LANGUAGES } from './formatters';

const ran = (actualOutput: string, status: 'Accepted' | 'Wrong Answer' = 'Wrong Answer') => ({
  status, output: '', executionTime: 3,
  testCaseResults: [{ passed: status === 'Accepted', input: 'x', expectedOutput: '', actualOutput }],
});

describe('custom input runs in the browser', () => {
  it('shows what the function returned when nothing is expected', () => {
    const r = shapeCustomResult(ran('[0,1]'), { input: 'nums = [2,7], target = 9' });
    expect(r).toMatchObject({ status: 'Ran', ranIn: 'browser', custom: { input: 'nums = [2,7], target = 9', output: '[0,1]', expected: null, error: null } });
    expect(r.custom!.matched).toBeUndefined();
  });

  it('compares with the expected output using the problem rule', () => {
    expect(shapeCustomResult(ran('[1,0]'), { input: 'x', expected: '[0,1]' }, 'unordered')).toMatchObject({ status: 'Accepted', custom: { matched: true } });
    expect(shapeCustomResult(ran('[1,0]'), { input: 'x', expected: '[0,1]' }, 'exact')).toMatchObject({ status: 'Wrong Answer', custom: { matched: false } });
  });

  it('reports errors instead of an output', () => {
    expect(shapeCustomResult(ran('Runtime Error: x is not defined'), { input: 'x' })).toMatchObject({
      status: 'Runtime Error', custom: { output: null, error: 'Runtime Error: x is not defined' },
    });
    expect(shapeCustomResult({ status: 'Time Limit Exceeded', output: 'Execution timed out after 5000ms.' }, { input: 'x' })).toMatchObject({
      status: 'Time Limit Exceeded', custom: { error: 'Execution timed out after 5000ms.' },
    });
  });
});

describe('editor settings', () => {
  it('formats memory for people', () => {
    expect(formatMemory(3400 * 1024)).toBe('3.3 MB');
    expect(formatMemory(512 * 1024)).toBe('512 KB');
    expect(formatMemory(undefined)).toBeNull();
    expect(formatMemory(0)).toBeNull();
  });

  it('offers more than light and dark, with ids the API accepts', () => {
    expect(EDITOR_THEMES.length).toBeGreaterThanOrEqual(8);
    expect(EDITOR_THEMES.filter((t) => t.dark).length).toBeGreaterThan(1);
    expect(EDITOR_THEMES.filter((t) => !t.dark).length).toBeGreaterThan(1);
    for (const t of EDITOR_THEMES) expect(t.id).toMatch(/^[a-z0-9-]{1,32}$/);
    expect(isKnownTheme('dracula')).toBe(true);
    expect(isKnownTheme('neon')).toBe(false);
  });

  it('formats every practice language', () => {
    expect(FORMATTABLE_LANGUAGES).toEqual(expect.arrayContaining(['javascript', 'python', 'java', 'cpp']));
    expect(CLANG_STYLE.cpp).toContain('IndentWidth: 4');
  });
});
