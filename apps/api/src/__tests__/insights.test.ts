import { mergeActivity, shapeStudy, weekStart, type ActivityItem } from '../modules/auth/services/insights.service';

describe('dashboard insights', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-10-09')).toBe('2026-10-05'); // Friday → Monday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday belongs to the week before
  });

  it('charts the last 14 days and checks the daily goal this week', () => {
    const s = shapeStudy([
      { day: '2026-10-09', seconds: 1800 }, { day: '2026-10-07', seconds: 600 }, { day: '2026-10-05', seconds: 3600 },
      { day: '2026-10-04', seconds: 7200 }, // last week: in the chart, not in this week
    ], '2026-10-09', 30);
    expect(s.days).toHaveLength(14);
    expect(s.days[0].date).toBe('2026-09-26');
    expect(s.days[13]).toEqual({ date: '2026-10-09', minutes: 30 });
    expect(s).toMatchObject({ today_minutes: 30, week_minutes: 100, goal_days_met: 2, week_days_so_far: 5 });
    expect(shapeStudy([], '2026-10-09', null)).toMatchObject({ goal_days_met: 0, week_minutes: 0 });
  });

  it('lists activity newest first and hides failed tries the same day as a solve', () => {
    const a = (kind: ActivityItem['kind'], link: string, at: string): ActivityItem => ({ kind, title: link, detail: null, link, at });
    const out = mergeActivity([
      a('attempted', '/problems/two-sum', '2026-10-09T05:00:00Z'),
      a('solved', '/problems/two-sum', '2026-10-09T06:00:00Z'),
      a('attempted', '/problems/two-sum', '2026-10-08T05:00:00Z'),
      a('chapter', '/chapter/1', '2026-10-09T07:00:00Z'),
    ]);
    expect(out.map((i) => `${i.kind}@${i.at.slice(0, 10)}`)).toEqual(['chapter@2026-10-09', 'solved@2026-10-09', 'attempted@2026-10-08']);
    expect(mergeActivity(Array.from({ length: 30 }, (_, i) => a('chapter', `/c/${i}`, `2026-10-0${1 + (i % 9)}T00:00:00Z`)))).toHaveLength(15);
  });
});
