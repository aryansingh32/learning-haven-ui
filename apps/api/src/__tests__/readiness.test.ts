/** Placement readiness: each part, the weights, the level and the next steps. */
import { levelFor, scoreReadiness, type ReadinessInputs } from '../modules/auth/services/readiness.service';

const none: ReadinessInputs = {
    solved: { easy: 0, medium: 0, hard: 0 },
    topics: [{ topic: 'Arrays', total: 10, solved: 0 }, { topic: 'Graphs', total: 5, solved: 0 }],
    assessments: { count: 0, averagePercent: null },
    chaptersCompleted: 0,
    projects: { completed: 0, inProgressPercent: [] },
    profile: { hasResume: false, skills: 0, publicPortfolio: false },
    activeDays30: 0,
};
const full: ReadinessInputs = {
    solved: { easy: 40, medium: 25, hard: 10 },
    topics: [{ topic: 'Arrays', total: 10, solved: 8 }, { topic: 'Graphs', total: 5, solved: 3 }],
    assessments: { count: 6, averagePercent: 100 },
    chaptersCompleted: 30,
    projects: { completed: 3, inProgressPercent: [] },
    profile: { hasResume: true, skills: 5, publicPortfolio: true },
    activeDays30: 25,
};
const part = (r: ReturnType<typeof scoreReadiness>, key: string) => r.parts.find((p) => p.key === key)!;

describe('scoreReadiness', () => {
    it('starts at zero with every part to do', () => {
        const r = scoreReadiness(none);
        expect(r.score).toBe(0);
        expect(r.level).toBe('Getting started');
        expect(r.nextSteps).toHaveLength(3);
        expect(r.nextSteps[0]).toMatchObject({ link: '/topics', gain: 30 }); // practice weighs most
        expect(r.weakTopics).toEqual(['Arrays', 'Graphs']);
    });

    it('reaches 100 when every target is met, with nothing left to suggest', () => {
        const r = scoreReadiness(full);
        expect(r.score).toBe(100);
        expect(r.level).toBe('Placement-ready');
        expect(r.nextSteps).toEqual([]);
        expect(r.parts.every((p) => p.next === null)).toBe(true);
    });

    it('weighs the parts 30/20/15/15/10/10', () => {
        expect(scoreReadiness({ ...none, chaptersCompleted: 24 }).score).toBe(15);
        expect(scoreReadiness({ ...none, profile: { hasResume: true, skills: 3, publicPortfolio: true } }).score).toBe(10);
        expect(scoreReadiness({ ...none, activeDays30: 20 }).score).toBe(10);
        expect(scoreReadiness({ ...none, projects: { completed: 3, inProgressPercent: [] } }).score).toBe(15);
    });

    it('counts harder problems for more, and topic coverage separately', () => {
        const easyOnly = part(scoreReadiness({ ...none, solved: { easy: 30, medium: 0, hard: 0 } }), 'practice').score;
        const hardOnly = part(scoreReadiness({ ...none, solved: { easy: 0, medium: 0, hard: 30 } }), 'practice').score;
        expect(easyOnly).toBe(20);
        expect(hardOnly).toBe(80);
        const covered = scoreReadiness({ ...none, solved: { easy: 2, medium: 0, hard: 0 }, topics: [{ topic: 'Arrays', total: 10, solved: 1 }, { topic: 'Graphs', total: 5, solved: 1 }] });
        expect(part(covered, 'practice').score).toBe(21); // 2/120*80 + 20 for full coverage
    });

    it('trusts test scores more as more tests are taken', () => {
        const one = part(scoreReadiness({ ...none, assessments: { count: 1, averagePercent: 80 } }), 'assessments').score;
        const five = part(scoreReadiness({ ...none, assessments: { count: 5, averagePercent: 80 } }), 'assessments').score;
        expect(one).toBe(54);
        expect(five).toBe(80);
    });

    it('gives half credit for a project half done', () => {
        expect(part(scoreReadiness({ ...none, projects: { completed: 0, inProgressPercent: [100, 50] } }), 'projects').score).toBe(25);
    });

    it('names levels by score', () => {
        expect([0, 29, 30, 54, 55, 79, 80, 100].map(levelFor)).toEqual([
            'Getting started', 'Getting started', 'Building up', 'Building up', 'Interview-ready', 'Interview-ready', 'Placement-ready', 'Placement-ready']);
    });
});
