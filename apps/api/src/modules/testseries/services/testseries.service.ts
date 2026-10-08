import { pool } from '../../../config/database';
import { scoreAttempt, AnswerState, ScoringQuestion } from '@repo/assessment-core';

interface QuestionRow {
  id: string;
  question_group_id: string | null;
  question_type: 'mcq' | 'msq' | 'nat';
  body: string;
  options: unknown;
  correct_options: string[] | null;
  nat_answer: string | null;
  nat_tolerance: string;
  marks: string;
  negative_marks: string;
  topic: string | null;
  difficulty: string | null;
  section_id: string | null;
  sort_order: number;
}

function toScoringQuestion(row: QuestionRow): ScoringQuestion {
  return {
    id: row.id,
    question_type: row.question_type,
    correct_options: row.correct_options,
    nat_answer: row.nat_answer !== null ? Number(row.nat_answer) : null,
    nat_tolerance: Number(row.nat_tolerance ?? 0),
    marks: Number(row.marks),
    negative_marks: Number(row.negative_marks ?? 0),
  };
}

// Correct answers are never sent to the client.
function toPublicQuestion(row: QuestionRow) {
  return {
    id: row.id,
    questionGroupId: row.question_group_id,
    questionType: row.question_type,
    body: row.body,
    options: row.options,
    marks: Number(row.marks),
    negativeMarks: Number(row.negative_marks ?? 0),
    topic: row.topic,
    difficulty: row.difficulty,
    sectionId: row.section_id,
    sortOrder: row.sort_order,
  };
}

export class TestSeriesService {
  // Public catalog: exam categories -> published series -> published (and
  // released) tests. Read-only, no attempt/timer side effects.
  static async getCatalog() {
    const categoriesResult = await pool.query(
      `SELECT id, slug, name, description, icon_url
       FROM public.exam_categories
       WHERE is_active = true
       ORDER BY sort_order ASC, name ASC`
    );

    const seriesResult = await pool.query(
      `SELECT id, exam_category_id, slug, title, description, year, is_free, price
       FROM public.test_series
       WHERE is_published = true AND deleted_at IS NULL
       ORDER BY created_at DESC`
    );

    const testsResult = await pool.query(
      `SELECT id, test_series_id, slug, title, duration_seconds, is_sectional, is_free
       FROM public.tests
       WHERE is_published = true AND deleted_at IS NULL AND (release_at IS NULL OR release_at <= NOW())
       ORDER BY sort_order ASC`
    );

    const testsBySeries = new Map<string, typeof testsResult.rows>();
    for (const t of testsResult.rows) {
      if (!t.test_series_id) continue;
      if (!testsBySeries.has(t.test_series_id)) testsBySeries.set(t.test_series_id, []);
      testsBySeries.get(t.test_series_id)!.push(t);
    }

    const seriesByCategory = new Map<string, any[]>();
    for (const s of seriesResult.rows) {
      const tests = (testsBySeries.get(s.id) || []).map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        durationSeconds: t.duration_seconds,
        isSectional: t.is_sectional,
        isFree: t.is_free,
      }));
      if (tests.length === 0) continue; // hide empty series from the public catalog
      if (!seriesByCategory.has(s.exam_category_id)) seriesByCategory.set(s.exam_category_id, []);
      seriesByCategory.get(s.exam_category_id)!.push({
        id: s.id,
        slug: s.slug,
        title: s.title,
        description: s.description,
        year: s.year,
        isFree: s.is_free,
        price: Number(s.price),
        tests,
      });
    }

    return categoriesResult.rows
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconUrl: c.icon_url,
        series: seriesByCategory.get(c.id) || [],
      }))
      .filter((c) => c.series.length > 0);
  }

  // Metadata only -- no attempt is created, no timer starts. Used to render
  // the pre-test instructions screen before the learner commits to starting.
  static async getTestMeta(testId: string) {
    const result = await pool.query(
      `SELECT t.id, t.title, t.instructions, t.duration_seconds, t.is_sectional, t.is_free, t.is_published, t.release_at,
              COUNT(tq.id)::int AS question_count
       FROM public.tests t
       LEFT JOIN public.test_questions tq ON tq.test_id = t.id
       WHERE t.id = $1 AND t.deleted_at IS NULL
       GROUP BY t.id`,
      [testId]
    );
    const test = result.rows[0];
    if (!test) throw new Error('Test not found');
    if (!test.is_published || (test.release_at && new Date(test.release_at) > new Date())) {
      throw new Error('Test not available');
    }
    return {
      id: test.id,
      title: test.title,
      instructions: test.instructions,
      durationSeconds: test.duration_seconds,
      isSectional: test.is_sectional,
      isFree: test.is_free,
      questionCount: test.question_count,
    };
  }

  static async getTestQuestions(testId: string): Promise<QuestionRow[]> {
    const result = await pool.query(
      `SELECT q.id, q.question_group_id, q.question_type, q.body, q.options, q.correct_options,
              q.nat_answer, q.nat_tolerance, q.marks, q.negative_marks, q.topic, q.difficulty,
              tq.section_id, tq.sort_order
       FROM public.test_questions tq
       JOIN public.testseries_questions q ON q.id = tq.question_id
       WHERE tq.test_id = $1
       ORDER BY tq.sort_order ASC`,
      [testId]
    );
    return result.rows;
  }

  static async startAttempt(userId: string, testId: string) {
    const testResult = await pool.query(
      `SELECT t.id, t.title, t.instructions, t.duration_seconds, t.is_sectional, t.section_time_locked,
              t.is_published, t.release_at, t.is_free AS test_is_free,
              COALESCE(s.is_free, true) AS series_is_free
       FROM public.tests t
       LEFT JOIN public.test_series s ON s.id = t.test_series_id
       WHERE t.id = $1`,
      [testId]
    );
    const test = testResult.rows[0];
    if (!test) throw new Error('Test not found');
    if (!test.is_published || (test.release_at && new Date(test.release_at) > new Date())) {
      throw new Error('Test not available');
    }
    // No purchase/entitlement layer exists yet (marketplace commerce is a
    // later phase) -- until it does, a test is attemptable only if it (or
    // its parent series) is explicitly marked free. This must be checked
    // here, not just hidden in the UI, or a paid test is fully accessible
    // to anyone who calls this endpoint directly.
    if (!test.test_is_free && !test.series_is_free) {
      throw new Error('This test requires purchase, which is not available yet');
    }

    const existing = await pool.query(
      `SELECT * FROM public.test_attempts WHERE user_id = $1 AND test_id = $2 AND status = 'in_progress'`,
      [userId, testId]
    );
    let attempt = existing.rows[0];
    if (attempt) {
      attempt = await this.finalizeIfExpired(attempt);
    }

    const questions = await this.getTestQuestions(testId);
    if (questions.length === 0) throw new Error('Test has no questions yet');

    if (!attempt) {
      const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
      const initialAnswers: AnswerState[] = questions.map((q) => ({
        question_id: q.id,
        status: 'not_visited',
        selected_options: null,
        nat_value: null,
      }));
      const insertResult = await pool.query(
        `INSERT INTO public.test_attempts
           (user_id, test_id, status, started_at, expires_at, answers, total_questions, total_marks)
         VALUES ($1, $2, 'in_progress', NOW(), NOW() + make_interval(secs => $3::int), $4::jsonb, $5, $6)
         RETURNING *`,
        [userId, testId, test.duration_seconds, JSON.stringify(initialAnswers), questions.length, totalMarks]
      );
      attempt = insertResult.rows[0];
    }

    return {
      attemptId: attempt.id,
      test: {
        id: test.id,
        title: test.title,
        instructions: test.instructions,
        isSectional: test.is_sectional,
        sectionTimeLocked: test.section_time_locked,
      },
      questions: questions.map(toPublicQuestion),
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      status: attempt.status,
      answers: attempt.answers,
      ...(attempt.status === 'completed'
        ? { score: Number(attempt.score), correctCount: attempt.correct_count, totalMarks: Number(attempt.total_marks) }
        : {}),
    };
  }

  private static async finalizeIfExpired(attempt: any) {
    if (attempt.status !== 'in_progress') return attempt;
    if (new Date(attempt.expires_at) > new Date()) return attempt;
    return this.finalize(attempt);
  }

  // Scores using the attempt's own server-persisted `answers` -- never a
  // client-supplied payload -- and pins submitted_at to the deadline when
  // called after expiry, so a late/manipulated client clock can't extend it.
  private static async finalize(attempt: any) {
    const questions = await this.getTestQuestions(attempt.test_id);
    const scoringQuestions = questions.map(toScoringQuestion);
    const answers: AnswerState[] = attempt.answers || [];
    const { totalScore, correctCount, totalMarks } = scoreAttempt(scoringQuestions, answers);

    const result = await pool.query(
      `UPDATE public.test_attempts
       SET status = 'completed', submitted_at = LEAST(NOW(), expires_at), score = $2, correct_count = $3, total_marks = $4
       WHERE id = $1 AND status = 'in_progress'
       RETURNING *`,
      [attempt.id, totalScore, correctCount, totalMarks]
    );
    if (result.rows.length > 0) return result.rows[0];

    // Lost a race against a concurrent finalize -- return the authoritative row.
    const fresh = await pool.query(`SELECT * FROM public.test_attempts WHERE id = $1`, [attempt.id]);
    return fresh.rows[0];
  }

  static async autosaveAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    payload: { selectedOptions?: string[] | null; natValue?: number | null; markedForReview?: boolean }
  ) {
    const attemptResult = await pool.query(`SELECT * FROM public.test_attempts WHERE id = $1 AND user_id = $2`, [
      attemptId,
      userId,
    ]);
    let attempt = attemptResult.rows[0];
    if (!attempt) throw new Error('Attempt not found');

    attempt = await this.finalizeIfExpired(attempt);
    if (attempt.status !== 'in_progress') {
      throw new Error('Attempt already finalized');
    }

    const hasAnswer =
      (Array.isArray(payload.selectedOptions) && payload.selectedOptions.length > 0) ||
      (payload.natValue !== undefined && payload.natValue !== null);

    const status = hasAnswer
      ? payload.markedForReview
        ? 'answered_marked'
        : 'answered'
      : payload.markedForReview
        ? 'marked_for_review'
        : 'visited';

    const answers: AnswerState[] = attempt.answers || [];
    const idx = answers.findIndex((a) => a.question_id === questionId);
    const entry: AnswerState = {
      question_id: questionId,
      status,
      selected_options: payload.selectedOptions ?? null,
      nat_value: payload.natValue ?? null,
    };
    if (idx >= 0) answers[idx] = entry;
    else answers.push(entry);

    // Guard against a race with a concurrent expiry-finalize between the
    // check above and this write.
    const updateResult = await pool.query(
      `UPDATE public.test_attempts SET answers = $2::jsonb WHERE id = $1 AND status = 'in_progress' RETURNING id`,
      [attemptId, JSON.stringify(answers)]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('Attempt already finalized');
    }
    return { attemptId, questionId, status };
  }

  static async submitAttempt(userId: string, attemptId: string) {
    const attemptResult = await pool.query(`SELECT * FROM public.test_attempts WHERE id = $1 AND user_id = $2`, [
      attemptId,
      userId,
    ]);
    const attempt = attemptResult.rows[0];
    if (!attempt) throw new Error('Attempt not found');

    if (attempt.status === 'completed') return this.toResult(attempt);

    const finalized = await this.finalize(attempt);
    return this.toResult(finalized);
  }

  static async getAttempt(userId: string, attemptId: string) {
    const attemptResult = await pool.query(`SELECT * FROM public.test_attempts WHERE id = $1 AND user_id = $2`, [
      attemptId,
      userId,
    ]);
    let attempt = attemptResult.rows[0];
    if (!attempt) throw new Error('Attempt not found');
    attempt = await this.finalizeIfExpired(attempt);
    return this.toResult(attempt);
  }

  private static toResult(attempt: any) {
    return {
      attemptId: attempt.id,
      status: attempt.status,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      submittedAt: attempt.submitted_at,
      answers: attempt.answers,
      score: attempt.score !== null && attempt.score !== undefined ? Number(attempt.score) : null,
      correctCount: attempt.correct_count,
      totalQuestions: attempt.total_questions,
      totalMarks: Number(attempt.total_marks),
    };
  }
}
