// Answer similarity between students, for the exam integrity report.
//
// Code is reduced to a token stream that ignores what copying usually changes —
// comments, whitespace, variable names, string and number literals — and then
// fingerprinted with winnowing (Schleimer, Wilkerson & Aiken, "Winnowing: local
// algorithms for document fingerprinting", SIGMOD 2003; the method behind MOSS).
// Two answers are similar when most of the smaller one's fingerprints appear in
// the other. Fingerprints of the starter code are removed first, so everyone
// sharing the template doesn't count, and very short answers are not compared.
// Written answers use word shingles the same way.

const KEYWORDS = new Set(
  (
    'if else for while do switch case break continue return function def class new this self ' +
    'public private protected static void int long double float char bool boolean string var let const ' +
    'import from include using namespace struct try catch finally throw throws in of and or not is None ' +
    'null true false True False lambda yield async await elif pass print println printf cout cin endl ' +
    'vector map set list dict range len push append pop size length std main System out Scanner'
  ).split(' '),
);

export interface CodeFingerprint {
  tokens: number;
  prints: Set<number>;
}

/** Strips comments and literals and renames identifiers, keeping the program's shape. */
export function normalizeCode(code: string): string[] {
  const src = code
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
    .replace(/("""|''')[\s\S]*?\1/g, ' S ') // python docstrings
    .replace(/\/\/[^\n]*/g, ' ') // // line
    .replace(/(^|\s)#[^\n]*/g, ' ') // # line (python), also drops C preprocessor lines
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, ' S ');
  const out: string[] = [];
  for (const m of src.matchAll(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|->|::|[^\s\w]/g)) {
    const t = m[0];
    if (/^\d/.test(t)) out.push('N');
    else if (/^[A-Za-z_$]/.test(t)) out.push(KEYWORDS.has(t) ? t : 'V');
    else if (t === ';') continue; // optional in some languages, often moved around
    else out.push(t);
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Winnowing fingerprints of a token stream (k-gram size k, window w). */
export function winnow(tokens: string[], k = 5, w = 4): Set<number> {
  const grams: number[] = [];
  for (let i = 0; i + k <= tokens.length; i++) grams.push(hash(tokens.slice(i, i + k).join(' ')));
  const prints = new Set<number>();
  if (grams.length === 0) return prints;
  if (grams.length <= w) { prints.add(Math.min(...grams)); return prints; }
  for (let i = 0; i + w <= grams.length; i++) prints.add(Math.min(...grams.slice(i, i + w)));
  return prints;
}

export function codeFingerprint(code: string, starter?: string | null): CodeFingerprint {
  const tokens = normalizeCode(code);
  const prints = winnow(tokens);
  if (starter) for (const p of winnow(normalizeCode(starter))) prints.delete(p);
  return { tokens: tokens.length, prints };
}

/** Words of a written answer, lower-cased, punctuation dropped. */
export function textFingerprint(text: string, k = 5): CodeFingerprint {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const prints = new Set<number>();
  for (let i = 0; i + k <= words.length; i++) prints.add(hash(words.slice(i, i + k).join(' ')));
  return { tokens: words.length, prints };
}

/** Share of the smaller answer's fingerprints found in the other (0–1). */
export function containment(a: CodeFingerprint, b: CodeFingerprint): number {
  const [small, big] = a.prints.size <= b.prints.size ? [a, b] : [b, a];
  if (small.prints.size === 0) return 0;
  let shared = 0;
  for (const p of small.prints) if (big.prints.has(p)) shared++;
  return shared / small.prints.size;
}

export interface SimilarityInput { id: string; fingerprint: CodeFingerprint }
export interface SimilarPair { a: string; b: string; score: number }

/**
 * Pairs whose answers are at least `threshold` similar. Answers shorter than
 * `minTokens` (or with few fingerprints left after removing the starter) are
 * skipped: everyone writes `return a + b` the same way.
 */
export function similarPairs(items: SimilarityInput[], threshold = 0.8, minTokens = 40, minPrints = 8): SimilarPair[] {
  const usable = items.filter((x) => x.fingerprint.tokens >= minTokens && x.fingerprint.prints.size >= minPrints);
  const pairs: SimilarPair[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const score = containment(usable[i].fingerprint, usable[j].fingerprint);
      if (score >= threshold) pairs.push({ a: usable[i].id, b: usable[j].id, score: Math.round(score * 100) / 100 });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

export interface TimedAttempt { id: string; durationSeconds: number; scorePercent: number }

/**
 * Attempts finished far faster than the class with a top score: finished in under
 * `fastShare` of the median time while scoring at or above the 75th percentile
 * (and at least 80%). Needs at least five finished attempts to say anything.
 */
export function fastAndHighScoring(attempts: TimedAttempt[], fastShare = 0.35): string[] {
  const done = attempts.filter((a) => a.durationSeconds > 0);
  if (done.length < 5) return [];
  const sorted = (xs: number[]) => [...xs].sort((p, q) => p - q);
  const q = (xs: number[], f: number) => sorted(xs)[Math.min(xs.length - 1, Math.floor(f * (xs.length - 1)))];
  const median = q(done.map((a) => a.durationSeconds), 0.5);
  const p75 = q(done.map((a) => a.scorePercent), 0.75);
  return done
    .filter((a) => a.durationSeconds < median * fastShare && a.scorePercent >= Math.max(80, p75))
    .map((a) => a.id);
}
