// Output comparison for coding problems, shared by the browser runner (Run),
// the server judge (Submit) and Campus coding questions, so a solution that
// passes in one place passes in all of them.
//
// Each language prints results its own way — JSON from JavaScript/Python,
// `[eat, tea]` from Java's toString, `True`/`None` from Python repr — so both
// sides are parsed leniently into plain values before comparing.

export type CompareMode =
  /** Same values in the same order. */
  | 'exact'
  /** The top-level list may be in any order (e.g. "return the k most frequent"). */
  | 'unordered'
  /** Lists at every level may be in any order (e.g. "group the anagrams"). */
  | 'unordered_deep';

export const COMPARE_MODES: readonly CompareMode[] = ['exact', 'unordered', 'unordered_deep'];

type Value = null | boolean | number | string | Value[];

const NUMBER_TOLERANCE = 1e-6;

/**
 * Parse printed output into a value. Accepts JSON, Python repr and Java
 * `toString` styles. Text that isn't a list/number/boolean stays a string.
 */
export function parseLoose(text: string): Value {
  const src = text.trim();
  let i = 0;

  const skipWs = () => { while (i < src.length && /\s/.test(src[i])) i++; };

  const parseValue = (stopAt: string): Value => {
    skipWs();
    const ch = src[i];
    if (ch === '[' || ch === '(' || ch === '{') {
      const close = ch === '[' ? ']' : ch === '(' ? ')' : '}';
      i++;
      const items: Value[] = [];
      skipWs();
      if (src[i] === close) { i++; return items; }
      while (i < src.length) {
        items.push(parseValue(`,${close}`));
        skipWs();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === close) { i++; break; }
        break;
      }
      return items;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let out = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue; }
        out += src[i++];
      }
      i++;
      return out;
    }
    // Bare token up to the next delimiter.
    let token = '';
    while (i < src.length && !stopAt.includes(src[i])) token += src[i++];
    return scalar(token.trim());
  };

  const value = parseValue('');
  skipWs();
  // Anything left over means this wasn't a single value: compare as text.
  return i >= src.length ? value : src;
}

function scalar(token: string): Value {
  if (token === '' ) return '';
  const lower = token.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null' || lower === 'none') return null;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(token)) return Number(token);
  return token;
}

/** Stable text form used to sort list items for order-insensitive modes. */
function canonical(v: Value): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'number') return `n:${Math.round(v / NUMBER_TOLERANCE)}`;
  return `${typeof v}:${String(v)}`;
}

function normalize(v: Value, mode: CompareMode, depth = 0): Value {
  if (!Array.isArray(v)) return v;
  const items = v.map((x) => normalize(x, mode, depth + 1));
  const sortHere = mode === 'unordered_deep' || (mode === 'unordered' && depth === 0);
  return sortHere ? [...items].sort((a, b) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0)) : items;
}

function equal(a: Value, b: Value): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, idx) => equal(x, b[idx]));
  }
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= NUMBER_TOLERANCE * Math.max(1, Math.abs(b));
  return a === b;
}

/** Does the printed `actual` output match the `expected` output under `mode`? */
export function compareOutputs(actual: string, expected: string, mode: CompareMode = 'exact'): boolean {
  if (actual.trim() === expected.trim()) return true;
  return equal(normalize(parseLoose(actual), mode), normalize(parseLoose(expected), mode));
}

export function isCompareMode(v: unknown): v is CompareMode {
  return typeof v === 'string' && (COMPARE_MODES as readonly string[]).includes(v);
}
