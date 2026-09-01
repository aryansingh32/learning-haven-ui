import { pool, supabase } from '../../../config/database';
import logger from '../../../config/logger';

type SnapshotQuestion = {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    chapter_title: string;
};

const MAX_QUESTIONS = 15;
const MIN_DURATION_SECONDS = 300; // 5 min
const MAX_DURATION_SECONDS = 1800; // 30 min
const SECONDS_PER_QUESTION = 60;

function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export class MockTestService {
    static async startMockTest(userId: string, courseId: string) {
        const courseResult = await pool.query('SELECT id, title FROM public.courses WHERE id = $1', [courseId]);
        const course = courseResult.rows[0];
        if (!course) {
            throw new Error('Course not found');
        }

        const stepsResult = await pool.query(
            `SELECT s.content, c.title AS chapter_title
             FROM public.steps s
             JOIN public.chapters c ON c.id = s.chapter_id
             WHERE c.course_id = $1 AND s.type = 'quiz'`,
            [courseId]
        );

        const questionPool: SnapshotQuestion[] = [];
        for (const row of stepsResult.rows) {
            const questions = Array.isArray(row.content?.quiz_questions) ? row.content.quiz_questions : [];
            for (const q of questions) {
                if (!q?.question || !Array.isArray(q.options)) continue;
                const correctIndex = q.options.indexOf(q.correctAnswer ?? q.correct_answer ?? '');
                if (correctIndex < 0) continue;
                questionPool.push({
                    question: q.question,
                    options: q.options,
                    correct_index: correctIndex,
                    explanation: q.explanation || '',
                    chapter_title: row.chapter_title,
                });
            }
        }

        if (questionPool.length < 3) {
            throw new Error('Not enough quiz questions in this course to build a mock test yet');
        }

        const selected = shuffle(questionPool).slice(0, MAX_QUESTIONS);
        const durationSeconds = Math.min(
            MAX_DURATION_SECONDS,
            Math.max(MIN_DURATION_SECONDS, selected.length * SECONDS_PER_QUESTION)
        );

        const { data: attempt, error } = await supabase
            .from('mock_test_attempts')
            .insert({
                user_id: userId,
                course_id: courseId,
                status: 'in_progress',
                duration_seconds: durationSeconds,
                total_questions: selected.length,
                questions_snapshot: selected,
            })
            .select('id, started_at')
            .single();

        if (error) {
            logger.error('Start mock test error:', { userId, courseId, error });
            throw new Error('Failed to start mock test');
        }

        return {
            test_id: attempt.id,
            started_at: attempt.started_at,
            duration_seconds: durationSeconds,
            course_title: course.title,
            questions: selected.map((q) => ({
                question: q.question,
                options: q.options,
                chapter_title: q.chapter_title,
            })),
        };
    }

    static async submitMockTest(
        userId: string,
        testId: string,
        answers: Array<{ question_index: number; selected_index: number }>
    ) {
        const { data: attempt, error: fetchError } = await supabase
            .from('mock_test_attempts')
            .select('*')
            .eq('id', testId)
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError || !attempt) {
            throw new Error('Mock test not found');
        }
        if (attempt.status === 'completed') {
            throw new Error('Mock test already submitted');
        }

        const snapshot: SnapshotQuestion[] = attempt.questions_snapshot || [];
        const answerByIndex = new Map<number, number>();
        (Array.isArray(answers) ? answers : []).forEach((a) => {
            if (typeof a?.question_index === 'number' && typeof a?.selected_index === 'number') {
                answerByIndex.set(a.question_index, a.selected_index);
            }
        });

        let correctCount = 0;
        const answersDetail = snapshot.map((q, idx) => {
            const selectedIndex = answerByIndex.get(idx) ?? -1;
            const isCorrect = selectedIndex === q.correct_index;
            if (isCorrect) correctCount += 1;
            return {
                question: q.question,
                options: q.options,
                selected_index: selectedIndex,
                selected_text: q.options[selectedIndex] ?? '',
                is_correct: isCorrect,
                correct_option: isCorrect ? null : q.options[q.correct_index] ?? null,
                explanation: q.explanation,
                chapter_title: q.chapter_title,
            };
        });

        const scorePercent = snapshot.length > 0 ? Math.round((correctCount / snapshot.length) * 100) : 0;
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('mock_test_attempts')
            .update({
                status: 'completed',
                correct_count: correctCount,
                score_percent: scorePercent,
                answers: answersDetail,
                submitted_at: now,
            })
            .eq('id', testId);

        if (updateError) {
            logger.error('Submit mock test error:', { userId, testId, updateError });
            throw new Error('Failed to submit mock test');
        }

        return {
            test_id: testId,
            score_percent: scorePercent,
            correct_count: correctCount,
            total_questions: snapshot.length,
            answers: answersDetail,
            submitted_at: now,
        };
    }

    static async getLatestMockTest(userId: string, courseId: string) {
        const { data, error } = await supabase
            .from('mock_test_attempts')
            .select('id, score_percent, correct_count, total_questions, answers, submitted_at')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .eq('status', 'completed')
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.error('Get latest mock test error:', { userId, courseId, error });
            return null;
        }

        return data || null;
    }
}
