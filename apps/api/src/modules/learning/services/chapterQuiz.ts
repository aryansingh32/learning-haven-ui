import { pool } from '../../../config/database';

/**
 * A chapter's quiz, graded on the server.
 *
 * Questions live in the chapter's quiz step (`steps.content.quiz_questions`, the
 * course builder's format, with `correctAnswer` as the option text); older content
 * has them in `chapter_content`. The answer may be stored as the option text or as
 * its index under several names; all are read. The browser only ever gets the
 * questions without answers, sends the chosen option indexes, and gets back the
 * result per question.
 */

export interface StoredQuestion {
    question?: string;
    q?: string;
    options?: unknown[];
    explanation?: string;
    [key: string]: unknown;
}

export interface QuestionResult {
    correct: boolean;
    skipped: boolean;
    selectedIndex: number;
    correctOption: string | null;
    explanation: string;
}

export const QUIZ_PASS_PERCENT = 66;
const ANSWER_FIELDS = ['correctAnswer', 'correct_answer', 'answer', 'correct_index', 'correctIndex'] as const;

/** The index of the right option, whichever way the content stores it; null if it can't be told. */
export function correctIndexOf(q: StoredQuestion): number | null {
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
    for (const field of ANSWER_FIELDS) {
        const v = q[field];
        if (v === undefined || v === null || v === '') continue;
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < options.length) return v;
        if (typeof v === 'string') {
            const byText = options.indexOf(v);
            if (byText >= 0) return byText;
            const trimmed = options.findIndex((o) => o.trim().toLowerCase() === v.trim().toLowerCase());
            if (trimmed >= 0) return trimmed;
            if (/^\d+$/.test(v) && Number(v) < options.length) return Number(v);
            // A single letter: "B" → 1
            if (/^[A-Ha-h]$/.test(v.trim())) {
                const i = v.trim().toUpperCase().charCodeAt(0) - 65;
                if (i < options.length) return i;
            }
        }
    }
    return null;
}

/** A question as the browser may see it: no answer fields. */
export function withoutAnswer<T extends StoredQuestion>(q: T): Omit<T, typeof ANSWER_FIELDS[number]> {
    const copy: Record<string, unknown> = { ...q };
    for (const f of ANSWER_FIELDS) delete copy[f];
    return copy as Omit<T, typeof ANSWER_FIELDS[number]>;
}

/** Strips answers from every quiz inside a list of steps (step content is sent to the browser). */
export function stepsWithoutAnswers<S extends { type?: string; content?: unknown }>(steps: S[]): S[] {
    return steps.map((s) => {
        const content = s.content as Record<string, unknown> | null | undefined;
        if (!content || typeof content !== 'object' || !Array.isArray(content.quiz_questions)) return s;
        return { ...s, content: { ...content, quiz_questions: (content.quiz_questions as StoredQuestion[]).map(withoutAnswer) } };
    });
}

/** The chapter's quiz questions, with answers (server only). */
export async function loadChapterQuiz(chapterId: string): Promise<StoredQuestion[]> {
    const { rows: stepRows } = await pool.query<{ content: Record<string, unknown> | null }>(
        `select content from public.steps where chapter_id = $1 and type = 'quiz' order by step_number asc`, [chapterId]);
    const fromSteps = stepRows.flatMap((r) => (Array.isArray(r.content?.quiz_questions) ? (r.content!.quiz_questions as StoredQuestion[]) : []));
    if (fromSteps.length) return fromSteps;
    // Older content: chapter_content.quiz_questions or chapter_content.quiz (read as JSON so a missing column isn't an error).
    const { rows } = await pool.query<{ c: Record<string, unknown> }>(
        `select to_jsonb(cc) as c from public.chapter_content cc where cc.chapter_id = $1`, [chapterId]);
    const c = rows[0]?.c ?? {};
    for (const key of ['quiz_questions', 'quiz']) {
        let v = c[key];
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
        if (Array.isArray(v) && v.length) return v as StoredQuestion[];
    }
    return [];
}

/** Grades chosen option indexes (-1 or missing = skipped). */
export function gradeQuiz(questions: StoredQuestion[], selected: unknown[]) {
    const results: QuestionResult[] = questions.map((q, i) => {
        const raw = selected[i];
        const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
        const pick = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < options.length ? raw : -1;
        const right = correctIndexOf(q);
        const correct = pick >= 0 && right !== null && pick === right;
        return {
            correct,
            skipped: pick < 0,
            selectedIndex: pick,
            correctOption: correct || right === null ? null : options[right] ?? null,
            explanation: typeof q.explanation === 'string' ? q.explanation : '',
        };
    });
    const score = results.filter((r) => r.correct).length;
    const total = questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    return { results, score, total, percent, passed: percent >= QUIZ_PASS_PERCENT };
}
