// Per-attempt question and option ordering.
//
// Order is derived from a seed (the attempt id), so it is stable across
// page reloads and server restarts without storing anything extra, yet
// differs between students sitting the same test side by side.

export interface OrderableQuestion {
  id: string;
  section_id: string | null;
  question_group_id: string | null;
  options?: Array<{ id: string }> | null;
}

export interface OrderingRules {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface AttemptOrder {
  /** Question ids in the order this student sees them. */
  questionIds: string[];
  /** Option ids per question, in display order (only for shuffled questions with options). */
  optionOrder: Record<string, string[]>;
}

/** 32-bit FNV-1a hash of a string, used to seed the generator. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, well-distributed PRNG; returns floats in [0, 1). */
function generator(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by a seed. Returns a new array. */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const rand = generator(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Order an attempt's questions. Sections keep their authored order (a
 * sectional test's timing depends on it); questions are shuffled within
 * each section, and questions sharing a passage (question_group_id) move
 * together as one block so a comprehension set is never split.
 */
export function buildAttemptOrder(
  questions: readonly OrderableQuestion[],
  rules: OrderingRules,
  seed: string
): AttemptOrder {
  const sections: string[] = [];
  const bySection = new Map<string, OrderableQuestion[]>();
  for (const q of questions) {
    const key = q.section_id ?? '';
    if (!bySection.has(key)) {
      bySection.set(key, []);
      sections.push(key);
    }
    bySection.get(key)!.push(q);
  }

  const questionIds: string[] = [];
  for (const section of sections) {
    const inSection = bySection.get(section)!;
    // Group passage questions into blocks, keeping first-seen order.
    const blocks: OrderableQuestion[][] = [];
    const blockOf = new Map<string, OrderableQuestion[]>();
    for (const q of inSection) {
      if (q.question_group_id) {
        let block = blockOf.get(q.question_group_id);
        if (!block) {
          block = [];
          blockOf.set(q.question_group_id, block);
          blocks.push(block);
        }
        block.push(q);
      } else {
        blocks.push([q]);
      }
    }
    const ordered = rules.shuffleQuestions ? shuffleWithSeed(blocks, `${seed}:section:${section}`) : blocks;
    for (const block of ordered) for (const q of block) questionIds.push(q.id);
  }

  const optionOrder: Record<string, string[]> = {};
  if (rules.shuffleOptions) {
    for (const q of questions) {
      if (Array.isArray(q.options) && q.options.length > 1) {
        optionOrder[q.id] = shuffleWithSeed(q.options.map((o) => o.id), `${seed}:options:${q.id}`);
      }
    }
  }

  return { questionIds, optionOrder };
}
