/**
 * Line diff between two versions of a solution (longest common subsequence),
 * shaped for an inline view and a side-by-side view. Pure, no dependencies.
 */

export type DiffOp =
  | { type: 'same'; text: string; a: number; b: number }
  | { type: 'del'; text: string; a: number }
  | { type: 'add'; text: string; b: number };

export interface SideBySideRow {
  left?: { no: number; text: string; changed: boolean };
  right?: { no: number; text: string; changed: boolean };
}

/** Above this many lines on either side the middle part is shown as replaced, to keep the browser responsive. */
const MAX_LCS_CELLS = 4_000_000;

const splitLines = (s: string) => {
  if (s === '') return [];
  const lines = s.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
};

/** Line numbers are 1-based. */
export function diffLines(before: string, after: string): DiffOp[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const ops: DiffOp[] = [];

  // Common prefix and suffix first: most edits are small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  for (let i = 0; i < start; i++) ops.push({ type: 'same', text: a[i], a: i + 1, b: i + 1 });

  const n = endA - start;
  const m = endB - start;
  if (n > 0 || m > 0) {
    if (n * m > MAX_LCS_CELLS) {
      for (let i = 0; i < n; i++) ops.push({ type: 'del', text: a[start + i], a: start + i + 1 });
      for (let j = 0; j < m; j++) ops.push({ type: 'add', text: b[start + j], b: start + j + 1 });
    } else {
      // lcs[i][j] = LCS length of a[start+i..endA) and b[start+j..endB).
      const w = m + 1;
      const lcs = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          lcs[i * w + j] = a[start + i] === b[start + j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      while (i < n || j < m) {
        if (i < n && j < m && a[start + i] === b[start + j]) {
          ops.push({ type: 'same', text: a[start + i], a: start + i + 1, b: start + j + 1 });
          i++; j++;
        } else if (j < m && (i === n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
          ops.push({ type: 'add', text: b[start + j], b: start + j + 1 });
          j++;
        } else {
          ops.push({ type: 'del', text: a[start + i], a: start + i + 1 });
          i++;
        }
      }
    }
  }

  for (let k = 0; k < a.length - endA; k++) ops.push({ type: 'same', text: a[endA + k], a: endA + k + 1, b: endB + k + 1 });
  return normalizeBlocks(ops);
}

/** Within each changed block, list removals before additions (reads better, pairs up side by side). */
function normalizeBlocks(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  let dels: DiffOp[] = [];
  let adds: DiffOp[] = [];
  const flush = () => { out.push(...dels, ...adds); dels = []; adds = []; };
  for (const op of ops) {
    if (op.type === 'same') { flush(); out.push(op); } else if (op.type === 'del') dels.push(op); else adds.push(op);
  }
  flush();
  return out;
}

export function diffStats(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) { if (op.type === 'add') added++; else if (op.type === 'del') removed++; }
  return { added, removed };
}

/** Pair removed and added lines of each changed block into rows. */
export function toSideBySide(ops: DiffOp[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'same') {
      rows.push({ left: { no: op.a, text: op.text, changed: false }, right: { no: op.b, text: op.text, changed: false } });
      i++;
      continue;
    }
    const dels: Array<Extract<DiffOp, { type: 'del' }>> = [];
    const adds: Array<Extract<DiffOp, { type: 'add' }>> = [];
    while (i < ops.length && ops[i].type !== 'same') {
      const o = ops[i++];
      if (o.type === 'del') dels.push(o); else if (o.type === 'add') adds.push(o);
    }
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      rows.push({
        ...(dels[k] ? { left: { no: dels[k].a, text: dels[k].text, changed: true } } : {}),
        ...(adds[k] ? { right: { no: adds[k].b, text: adds[k].text, changed: true } } : {}),
      });
    }
  }
  return rows;
}

/** Collapse long unchanged stretches, keeping `context` lines around each change. */
export function collapseUnchanged<T>(items: T[], isChanged: (t: T) => boolean, context = 3): Array<T | { skipped: number }> {
  const keep = items.map(() => false);
  items.forEach((t, idx) => {
    if (!isChanged(t)) return;
    for (let k = Math.max(0, idx - context); k <= Math.min(items.length - 1, idx + context); k++) keep[k] = true;
  });
  if (!keep.includes(true)) return items.length > context * 2 + 1 ? [...items.slice(0, context), { skipped: items.length - context }] : items;
  const out: Array<T | { skipped: number }> = [];
  let skipped = 0;
  items.forEach((t, idx) => {
    if (keep[idx]) {
      if (skipped) { out.push({ skipped }); skipped = 0; }
      out.push(t);
    } else skipped++;
  });
  if (skipped) out.push({ skipped });
  return out;
}
