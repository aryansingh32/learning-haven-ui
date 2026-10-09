// Timed, locked sections (CAT / NQT style): one section at a time, each with
// its own clock; when a section's time is up the attempt moves to the next
// one and the student can't go back. Pure functions: the server decides.

export interface TimedSection {
  id: string;
  durationSeconds: number;
}

export interface SectionPosition {
  index: number;
  startedAt: Date;
}

export interface SectionClock extends SectionPosition {
  /** When the current section closes (never after the attempt's own deadline). */
  endsAt: Date;
  /** True when the last section has closed: the attempt should be submitted. */
  finished: boolean;
}

const plus = (d: Date, seconds: number) => new Date(d.getTime() + seconds * 1000);
const earlier = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);

/**
 * Where the attempt is now. Sections whose time ran out are skipped forward;
 * the next section's clock starts when the previous one closed (not when the
 * student comes back), so being offline never buys extra time.
 */
export function sectionClock(sections: readonly TimedSection[], at: SectionPosition, attemptEndsAt: Date, now: Date): SectionClock {
  if (sections.length === 0) throw new Error('A timed test needs at least one section.');
  let index = Math.min(Math.max(at.index, 0), sections.length - 1);
  let startedAt = at.startedAt;
  for (;;) {
    const endsAt = earlier(plus(startedAt, sections[index].durationSeconds), attemptEndsAt);
    if (now < endsAt) return { index, startedAt, endsAt, finished: false };
    const last = index === sections.length - 1 || endsAt.getTime() >= attemptEndsAt.getTime();
    if (last) return { index, startedAt, endsAt, finished: true };
    index += 1;
    startedAt = endsAt;
  }
}

/** The student finishes the current section early: the next one starts now. */
export function finishSection(sections: readonly TimedSection[], at: SectionPosition, attemptEndsAt: Date, now: Date): SectionClock {
  const current = sectionClock(sections, at, attemptEndsAt, now);
  if (current.finished || current.index === sections.length - 1) return { ...current, endsAt: earlier(now, current.endsAt), finished: true };
  return sectionClock(sections, { index: current.index + 1, startedAt: now }, attemptEndsAt, now);
}

/** Total time a locked test takes: the sum of its sections. */
export const totalSectionSeconds = (sections: readonly TimedSection[]) => sections.reduce((s, x) => s + x.durationSeconds, 0);
