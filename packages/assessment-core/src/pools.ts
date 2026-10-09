// Question pools: a section (or the unsectioned part of a test) deals N of its
// M questions to each attempt. The choice is seeded by the attempt id, so it is
// stable for that attempt and different between students.

import { shuffleWithSeed } from './shuffle';

export interface PoolableQuestion {
  id: string;
  section_id: string | null;
}

/**
 * Keep `drawCount` questions from each pooled section (key: section id, or ''
 * for questions in no section). Sections without a draw count keep everything.
 * The kept questions stay in their authored order; shuffling happens later.
 */
export function drawFromPools<T extends PoolableQuestion>(
  questions: readonly T[],
  drawCounts: ReadonlyMap<string, number>,
  seed: string
): T[] {
  const keep = new Set<string>();
  const bySection = new Map<string, T[]>();
  for (const q of questions) {
    const key = q.section_id ?? '';
    bySection.set(key, [...(bySection.get(key) ?? []), q]);
  }
  for (const [key, pool] of bySection) {
    const n = drawCounts.get(key);
    const chosen = n && n < pool.length ? shuffleWithSeed(pool, `${seed}:pool:${key}`).slice(0, n) : pool;
    for (const q of chosen) keep.add(q.id);
  }
  return questions.filter((q) => keep.has(q.id));
}
