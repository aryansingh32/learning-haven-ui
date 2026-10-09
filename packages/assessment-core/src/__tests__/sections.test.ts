import { finishSection, sectionClock, totalSectionSeconds, TimedSection } from '../sections';

const S: TimedSection[] = [{ id: 'a', durationSeconds: 600 }, { id: 'b', durationSeconds: 300 }, { id: 'c', durationSeconds: 900 }];
const t0 = new Date('2026-10-12T10:00:00Z');
const at = (s: number) => new Date(t0.getTime() + s * 1000);
const END = at(totalSectionSeconds(S)); // 1800 s

describe('sectionClock', () => {
  it('stays in the first section until its time is up', () => {
    expect(sectionClock(S, { index: 0, startedAt: t0 }, END, at(599))).toMatchObject({ index: 0, endsAt: at(600), finished: false });
  });

  it('moves on when a section closes, with the next clock starting at the close', () => {
    expect(sectionClock(S, { index: 0, startedAt: t0 }, END, at(600))).toMatchObject({ index: 1, startedAt: at(600), endsAt: at(900) });
  });

  it('skips several sections for a student who was away (no extra time)', () => {
    expect(sectionClock(S, { index: 0, startedAt: t0 }, END, at(1000))).toMatchObject({ index: 2, startedAt: at(900), endsAt: at(1800), finished: false });
  });

  it('is finished after the last section', () => {
    expect(sectionClock(S, { index: 0, startedAt: t0 }, END, at(5000))).toMatchObject({ index: 2, finished: true });
  });

  it('never runs past the attempt deadline (e.g. the assignment closes early)', () => {
    const closes = at(700);
    expect(sectionClock(S, { index: 0, startedAt: t0 }, closes, at(650))).toMatchObject({ index: 1, endsAt: at(700), finished: false });
    expect(sectionClock(S, { index: 0, startedAt: t0 }, closes, at(700))).toMatchObject({ finished: true });
  });
});

describe('finishSection', () => {
  it('starts the next section immediately; leftover time is forfeited', () => {
    expect(finishSection(S, { index: 0, startedAt: t0 }, END, at(120))).toMatchObject({ index: 1, startedAt: at(120), endsAt: at(420), finished: false });
  });

  it('finishing the last section finishes the attempt', () => {
    expect(finishSection(S, { index: 2, startedAt: at(900) }, END, at(1000))).toMatchObject({ index: 2, finished: true });
  });
});
