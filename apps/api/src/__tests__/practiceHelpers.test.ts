import { cleanCompany, cleanSearch, indiaDate, pickDaily } from '../modules/learning/services/practiceHelpers';

describe('practice helpers', () => {
    it('cleans search text', () => {
        expect(cleanSearch('  two   sum ')).toBe('two sum');
        expect(cleanSearch('100%_off,(a)')).toBe('100 off a');
        expect(cleanSearch('C++ & C#')).toBe('C++ C#');
        expect(cleanSearch('%%%')).toBeUndefined();
        expect(cleanSearch(['x'])).toBeUndefined();
        expect(cleanSearch('a'.repeat(200))!.length).toBe(80);
    });

    it('accepts plausible company names only', () => {
        expect(cleanCompany('Amazon')).toBe('Amazon');
        expect(cleanCompany("McKinsey & Co.")).toBe("McKinsey & Co.");
        expect(cleanCompany('a,b)')).toBeUndefined();
        expect(cleanCompany('')).toBeUndefined();
        expect(cleanCompany(undefined)).toBeUndefined();
    });

    it('turns the day over at midnight in India', () => {
        expect(indiaDate(new Date('2026-10-09T18:29:00Z'))).toBe('2026-10-09');
        expect(indiaDate(new Date('2026-10-09T18:31:00Z'))).toBe('2026-10-10');
    });

    it('picks every problem once before repeating, the same way every time', () => {
        const problems = ['two-sum', 'valid-anagram', 'contains-duplicate', 'group-anagrams', 'top-k-frequent'].map((slug) => ({ slug }));
        const days = Array.from({ length: 5 }, (_, i) => `2026-10-${String(10 + i).padStart(2, '0')}`);
        const picks = days.map((d) => pickDaily(problems, d)!.slug);
        expect(new Set(picks).size).toBe(5);
        expect(pickDaily([...problems].reverse(), days[0])!.slug).toBe(picks[0]);
        expect(pickDaily(problems, '2026-10-15')!.slug).toBe(picks[0]);
        expect(pickDaily([], days[0])).toBeNull();
    });
});
