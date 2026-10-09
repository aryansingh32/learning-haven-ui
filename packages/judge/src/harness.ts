import { cppFunctionHint } from './cpp';
// Per-language harnesses that call a learner's function exactly the way the
// browser runner does (same `name = value` inputs, same function detection).
// Pure string functions; execution lives in runner.ts.

export const JUDGED_LANGUAGES = ['javascript', 'python', 'java', 'cpp'] as const;
export type JudgedLanguage = (typeof JUDGED_LANGUAGES)[number];

export interface JudgeTest {
  input: string;
  expected: string;
  isSample: boolean;
}

export type Verdict = 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compilation Error' | 'Time Limit Exceeded';

export interface TestVerdict {
  index: number;
  passed: boolean;
  isSample: boolean;
  /** Actual output or error text — reported for sample tests only. */
  actual?: string;
  error?: string;
}

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  tests: TestVerdict[];
  /** Compiler / interpreter message when the program didn't run at all. */
  message?: string;
  timeMs: number;
  /** Peak memory of the whole run in KB (all tests run in one program), when the runner reports it. */
  memoryKb?: number;
}



// ── Harnesses ──────────────────────────────────────────────────────────────

/** Function the problem expects, read from its starter code, e.g. "twoSum". */
export function functionHint(language: JudgedLanguage, starter: string | undefined): string {
  if (!starter) return '';
  if (language === 'cpp') return cppFunctionHint(starter);
  const patterns: Record<Exclude<JudgedLanguage, 'cpp'>, RegExp> = {
    javascript: /function\s+([A-Za-z_$][\w$]*)\s*\(/,
    python: /def\s+([A-Za-z_]\w*)\s*\(\s*self/,
    java: /public\s+[\w<>\[\],\s]+?\s+([A-Za-z_]\w*)\s*\(/,
  };
  return starter.match(patterns[language])?.[1] ?? '';
}

/** Top-level function names in declaration order (static scan, like the browser runner). */
export function declaredJsFunctions(code: string): string[] {
  const names: string[] = [];
  const re = /(?:function\s+([a-zA-Z_$][\w$]*)\s*\()|(?:(?:var|let|const)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:function|\())/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) names.push(m[1] || m[2]);
  return names;
}

export function javascriptHarness(code: string, hint: string, marker: string): string {
  // Node 12 on Judge0 CE: keep the harness to ES2018.
  return `${code}
;(function () {
  var __inputs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  var __hint = ${JSON.stringify(hint)};
  function __find() {
    if (typeof Solution !== 'undefined') {
      var sol = new Solution();
      var methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sol)).filter(function (m) { return m !== 'constructor' && typeof sol[m] === 'function'; });
      var m = methods.indexOf(__hint) >= 0 ? __hint : methods[0];
      if (m) return sol[m].bind(sol);
    }
    // The expected name first, then the last function defined (what the browser runner picks).
    var names = ${JSON.stringify([hint, ...declaredJsFunctions(code).reverse()].filter(Boolean))};
    for (var n = 0; n < names.length; n++) {
      try { if (typeof eval(names[n]) === 'function') return eval(names[n]); } catch (e) {}
    }
    return null;
  }
  function __args(input) {
    var cleaned = String(input).replace(/[a-zA-Z_]\\w*\\s*=\\s*/g, '').trim();
    return cleaned ? JSON.parse('[' + cleaned + ']') : [];
  }
  var fn = __find();
  for (var i = 0; i < __inputs.length; i++) {
    if (!fn) { console.log(${JSON.stringify(marker)} + 'E' + i + ':No function named ' + __hint + ' found in your code.'); continue; }
    try {
      var r = fn.apply(null, __args(__inputs[i]));
      console.log(${JSON.stringify(marker)} + 'O' + i + ':' + (r === undefined ? 'null' : JSON.stringify(r)));
    } catch (e) {
      console.log(${JSON.stringify(marker)} + 'E' + i + ':' + String(e && e.message ? e.message : e).replace(/\\n/g, ' '));
    }
  }
})();
`;
}

export function pythonHarness(code: string, hint: string, marker: string): string {
  return `${code}

import json as __forge_json, re as __forge_re, sys as __forge_sys, inspect as __forge_inspect
def __forge_find(hint):
    g = globals()
    if 'Solution' in g and __forge_inspect.isclass(g['Solution']):
        sol = g['Solution']()
        methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]
        if hint in methods:
            return getattr(sol, hint)
        if methods:
            return getattr(sol, methods[0])
    if hint in g and callable(g[hint]):
        return g[hint]
    # Otherwise the last function the learner defined (what the browser runner picks).
    for name in reversed(list(g.keys())):
        obj = g[name]
        if __forge_inspect.isfunction(obj) and not name.startswith('_') and obj.__module__ == '__main__':
            return obj
    return None

def __forge_main():
    marker = ${JSON.stringify(marker)}
    inputs = __forge_json.loads(__forge_sys.stdin.read())
    fn = __forge_find(${JSON.stringify(hint)})
    for i, inp in enumerate(inputs):
        if fn is None:
            print(marker + 'E' + str(i) + ':No function named ${hint || 'solution'} found in your code.')
            continue
        try:
            cleaned = __forge_re.sub(r'[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*', '', inp).strip()
            args = __forge_json.loads('[' + cleaned + ']') if cleaned else []
            r = fn(*args)
            print(marker + 'O' + str(i) + ':' + __forge_json.dumps(r, default=list))
        except Exception as e:
            print(marker + 'E' + str(i) + ':' + (type(e).__name__ + ': ' + str(e)).replace('\\n', ' '))

__forge_main()
`;
}

export const TAMPERED = 'Your code printed a line that imitates the judge, so this test was not counted.';

/** Pull per-test outputs out of the harness's stdout. */
export function parseMarked(stdout: string, marker: string, count: number): Array<{ ok: boolean; text: string } | null> {
  const out: Array<{ ok: boolean; text: string } | null> = Array.from({ length: count }, () => null);
  const seen: boolean[] = Array.from({ length: count }, () => false);
  for (const line of stdout.split('\n')) {
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const m = rest.match(/^([OE])(\d+):(.*)$/);
    if (!m) continue;
    const idx = Number(m[2]);
    if (idx < 0 || idx >= count) continue;
    // The harness prints exactly one line per test. A second one means the
    // learner's code printed a fake result line: that test fails.
    if (seen[idx]) out[idx] = { ok: false, text: TAMPERED };
    else out[idx] = { ok: m[1] === 'O', text: m[3] };
    seen[idx] = true;
  }
  return out;
}

