/**
 * Chapter quizzes graded on the server: every way content stores the answer,
 * skipped questions, and answers never reaching the browser.
 */
jest.mock('../config/database', () => ({ pool: { query: jest.fn() }, supabase: {} }));
import { correctIndexOf, gradeQuiz, stepsWithoutAnswers, withoutAnswer } from '../modules/learning/services/chapterQuiz';

const opts = ['The browser renders the page', 'The browser requests the page from a server', 'CSS is applied'];

describe('correctIndexOf', () => {
    it('reads the answer stored as the option text (the course builder format on live)', () => {
        expect(correctIndexOf({ options: opts, correctAnswer: 'The browser requests the page from a server' })).toBe(1);
        expect(correctIndexOf({ options: opts, correctAnswer: '  css is applied ' })).toBe(2);
    });
    it('reads an index under any of the older names', () => {
        expect(correctIndexOf({ options: opts, answer: 2 })).toBe(2);
        expect(correctIndexOf({ options: opts, correct_index: 0 })).toBe(0);
        expect(correctIndexOf({ options: opts, correctIndex: '1' })).toBe(1);
        expect(correctIndexOf({ options: opts, correct_answer: 'B' })).toBe(1);
    });
    it('gives up (no answer) rather than guessing', () => {
        expect(correctIndexOf({ options: opts })).toBeNull();
        expect(correctIndexOf({ options: opts, correctAnswer: 'Not an option' })).toBeNull();
        expect(correctIndexOf({ options: opts, answer: 9 })).toBeNull();
    });
});

describe('gradeQuiz', () => {
    const qs = [
        { question: 'First?', options: opts, correctAnswer: opts[1], explanation: 'Request first.' },
        { question: 'Second?', options: ['a', 'b'], answer: 0 },
        { question: 'Third?', options: ['x', 'y'], correctAnswer: 'y' },
    ];
    it('scores, keeps skipped apart and reveals the right option only when wrong', () => {
        const g = gradeQuiz(qs, [1, 1, -1]);
        expect(g).toMatchObject({ score: 1, total: 3, percent: 33, passed: false });
        expect(g.results[0]).toMatchObject({ correct: true, correctOption: null, explanation: 'Request first.' });
        expect(g.results[1]).toMatchObject({ correct: false, skipped: false, correctOption: 'a' });
        expect(g.results[2]).toMatchObject({ correct: false, skipped: true, correctOption: 'y' });
    });
    it('passes at 66% and ignores nonsense picks', () => {
        expect(gradeQuiz(qs, [1, 0, 0]).passed).toBe(true);
        expect(gradeQuiz(qs, ['1', 99, null]).score).toBe(0);
    });
});

describe('answers never reach the browser', () => {
    it('strips every answer field from a question', () => {
        const q = withoutAnswer({ question: 'Q', options: opts, correctAnswer: opts[1], answer: 1, correct_index: 1, explanation: 'kept' });
        expect(q).toEqual({ question: 'Q', options: opts, explanation: 'kept' });
    });
    it('strips quiz steps and leaves other steps alone', () => {
        const steps = [
            { type: 'video', content: { url: 'v' } },
            { type: 'quiz', content: { intro: 'hi', quiz_questions: [{ question: 'Q', options: opts, correctAnswer: opts[0] }] } },
        ];
        const out = stepsWithoutAnswers(steps);
        expect(out[0]).toBe(steps[0]);
        expect(JSON.stringify(out)).not.toContain('correctAnswer');
        expect((out[1].content as any).intro).toBe('hi');
        expect(steps[1].content.quiz_questions[0].correctAnswer).toBe(opts[0]); // original untouched
    });
});
