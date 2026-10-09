import {
    indiaWeek, istDay, weekStats, missionViews, missionRewardKey, sanitizeMissions, DEFAULT_WEEKLY_MISSIONS,
    codingStreak, milestonesReached, MILESTONES, collectionViews, COLLECTIONS, displayName, dailyCap,
} from '../utils/achievements';

describe('India week', () => {
    it('runs Monday to Sunday and starts at 18:30 UTC on Sunday', () => {
        expect(indiaWeek('2026-10-09')).toEqual({ start: '2026-10-05', end: '2026-10-11', startsAt: '2026-10-04T18:30:00.000Z', daysLeft: 3 });
        expect(indiaWeek('2026-10-11')).toMatchObject({ start: '2026-10-05', daysLeft: 1 }); // Sunday is the last day
        expect(indiaWeek('2026-10-12')).toMatchObject({ start: '2026-10-12', daysLeft: 7 });
    });

    it('puts a late-evening UTC moment on the next India day', () => {
        expect(istDay('2026-10-11T18:29:00Z')).toBe('2026-10-11'); // Sunday 23:59 IST
        expect(istDay('2026-10-11T18:30:00Z')).toBe('2026-10-12'); // Monday 00:00 IST — next week
    });
});

describe('weekly missions', () => {
    const week = { start: '2026-10-05', end: '2026-10-11' };
    const stats = weekStats({
        solveDays: ['2026-10-05', '2026-10-05', '2026-10-07', '2026-10-04'], // one from last week
        chapterDays: ['2026-10-08'],
        study: [{ day: '2026-10-06', seconds: 200 }, { day: '2026-10-09', seconds: 3600 }, { day: '2026-10-04', seconds: 9000 }],
        otherActiveDays: ['2026-10-10'],
    }, week);

    it('counts only this week, and a day is active with real work or 5+ minutes of study', () => {
        // Active: 05 (solve), 07 (solve), 08 (chapter), 09 (60 min), 10 (accepted submission); 06 had only 3 min.
        expect(stats).toEqual({ solved: 3, chapters: 1, study_minutes: 63, active_days: 5 });
    });

    it('shows progress, and claimable / pending / paid from the reward rows', () => {
        const claimed = new Map([[missionRewardKey('2026-10-05', 'active_days'), 'pending' as const]]);
        const views = missionViews(DEFAULT_WEEKLY_MISSIONS, stats, claimed, '2026-10-05');
        const by = Object.fromEntries(views.map((v) => [v.key, v]));
        expect(by.solve_problems).toMatchObject({ progress: 3, target: 5, complete: false, state: 'locked' });
        expect(by.active_days).toMatchObject({ progress: 4, complete: true, state: 'pending' }); // progress is capped at the target
        const paid = missionViews(DEFAULT_WEEKLY_MISSIONS, { ...stats, solved: 6 }, new Map([[missionRewardKey('2026-10-05', 'solve_problems'), 'paid' as const]]), '2026-10-05');
        expect(paid[0].state).toBe('paid');
        // Last week's claim doesn't count this week.
        const nextWeek = missionViews(DEFAULT_WEEKLY_MISSIONS, { ...stats, solved: 6 }, new Map([[missionRewardKey('2026-09-28', 'solve_problems'), 'paid' as const]]), '2026-10-05');
        expect(nextWeek[0].state).toBe('claimable');
    });

    it('uses admin missions only when every one is well-formed', () => {
        const good = [{ key: 'solve_ten', label: 'Solve 10', metric: 'solved', target: 10, xp: 150 }];
        expect(sanitizeMissions(good)).toEqual(good);
        expect(sanitizeMissions(undefined)).toBe(DEFAULT_WEEKLY_MISSIONS);
        expect(sanitizeMissions([...good, { key: 'x', label: 'X', metric: 'solved', target: 1, xp: 99999 }])).toBe(DEFAULT_WEEKLY_MISSIONS);
        expect(sanitizeMissions([good[0], good[0]])).toBe(DEFAULT_WEEKLY_MISSIONS); // duplicate key
        expect(sanitizeMissions([{ ...good[0], metric: 'logins' }])).toBe(DEFAULT_WEEKLY_MISSIONS);
        expect(sanitizeMissions([{ ...good[0], key: 'Bad Key' }])).toBe(DEFAULT_WEEKLY_MISSIONS);
    });
});

describe('coding streak', () => {
    it('counts consecutive India days with a solve; alive through yesterday', () => {
        const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
        expect(codingStreak(days, '2026-10-08')).toEqual({ current: 4, longest: 4, today_done: true, last_day: '2026-10-08' });
        expect(codingStreak(days, '2026-10-09')).toMatchObject({ current: 4, today_done: false }); // today not over yet
        expect(codingStreak(days, '2026-10-10')).toMatchObject({ current: 0, longest: 4 }); // missed a day
    });

    it('ignores duplicates and future days, handles none', () => {
        expect(codingStreak(['2026-10-08', '2026-10-08', '2026-10-09', '2026-10-20'], '2026-10-09')).toMatchObject({ current: 2, longest: 2 });
        expect(codingStreak([], '2026-10-09')).toEqual({ current: 0, longest: 0, today_done: false, last_day: null });
        expect(codingStreak(['2026-09-30', '2026-10-01'], '2026-10-01')).toMatchObject({ current: 2 }); // across a month
    });
});

describe('milestones and collections', () => {
    it('reaches milestones by solves, chapters and the longest coding streak', () => {
        const ids = milestonesReached({ solved: 25, chapters: 1, coding_streak: 7 }).map((m) => m.id);
        expect(ids).toEqual(['solved_1', 'solved_10', 'solved_25', 'chapters_1', 'coding_streak_7']);
        expect(milestonesReached({ solved: 0, chapters: 0, coding_streak: 0 })).toEqual([]);
    });

    it('has unique ids and badges that fit the database rules', () => {
        expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length);
        for (const m of MILESTONES) {
            expect(m.badge.id).toMatch(/^[a-z0-9_]{3,60}$/);
            expect(`milestone:${m.id}`).toMatch(/^[a-z0-9_:.-]{3,80}$/);
            expect(m.xp).toBeLessThanOrEqual(1000);
        }
        expect(missionRewardKey('2026-10-05', 'complete_chapters')).toMatch(/^[a-z0-9_:.-]{3,80}$/);
    });

    it('every collection badge is one something actually awards', () => {
        const awardable = new Set([...MILESTONES.map((m) => m.badge.id), 'first_step', 'week_streak', 'dsa_champion', 'fast_learner']);
        for (const c of COLLECTIONS) for (const b of c.badges) expect(awardable.has(b.id)).toBe(true);
    });

    it('counts earned badges per collection', () => {
        const views = collectionViews(new Map([['milestone_solved_1', '2026-10-01T00:00:00.000Z'], ['milestone_solved_10', '2026-10-05T00:00:00.000Z'], ['first_step', 'x']]));
        expect(views.find((c) => c.id === 'problem_solver')).toMatchObject({ earned: 2, total: 5, complete: false });
        expect(views.find((c) => c.id === 'learning_journey')).toMatchObject({ earned: 1, total: 3 });
        expect(views.find((c) => c.id === 'problem_solver')!.badges[0]).toMatchObject({ earned: true, earned_at: '2026-10-01T00:00:00.000Z' });
    });
});

describe('leaderboard names and the daily limit', () => {
    it('shows a first name and an initial only', () => {
        expect(displayName('Priya Sharma')).toBe('Priya S.');
        expect(displayName('  arjun  k  reddy ')).toBe('arjun R.');
        expect(displayName('Meera')).toBe('Meera');
        expect(displayName('')).toBe('Learner');
        expect(displayName(null)).toBe('Learner');
        expect(displayName('priya@svce.edu.in')).toBe('Learner'); // never an email
    });

    it('reads the limit from settings, with a safe default', () => {
        expect(dailyCap(500, undefined)).toBe(500);
        expect(dailyCap('750', 200)).toBe(750);
        expect(dailyCap(undefined, 200)).toBe(200);
        expect(dailyCap('lots', -1)).toBe(300);
        expect(dailyCap(0, undefined)).toBe(300);
    });
});
