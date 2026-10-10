/**
 * The list validator replaces req.query with what it parsed, so any filter it doesn't
 * declare is silently dropped. "From your college" depends on ?college= getting through.
 */
import { getProblemsSchema } from '../utils/validators';

describe('getProblemsSchema', () => {
    const college = '763249e0-70d2-447e-b332-bb9504925bb8';

    it('keeps the college filter', () => {
        expect(getProblemsSchema.parse({ query: { college, limit: '100' } }).query.college).toBe(college);
    });

    it('rejects a college that is not an id', () => {
        expect(() => getProblemsSchema.parse({ query: { college: "x' or 1=1" } })).toThrow();
    });
});
