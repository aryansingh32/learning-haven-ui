import { pool } from '../../../config/database';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ══════════════════════════════════════════════════════════
// Exam Categories
// ══════════════════════════════════════════════════════════

export class AdminExamCategoriesService {
  static async list() {
    const result = await pool.query(
      `SELECT ec.*, COUNT(ts.id)::int AS series_count
       FROM public.exam_categories ec
       LEFT JOIN public.test_series ts ON ts.exam_category_id = ec.id AND ts.deleted_at IS NULL
       GROUP BY ec.id
       ORDER BY ec.sort_order ASC, ec.name ASC`
    );
    return result.rows;
  }

  static async create(input: { slug?: string; name: string; description?: string; iconUrl?: string; sortOrder?: number }) {
    const slug = input.slug?.trim() || slugify(input.name);
    const result = await pool.query(
      `INSERT INTO public.exam_categories (slug, name, description, icon_url, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [slug, input.name, input.description ?? null, input.iconUrl ?? null, input.sortOrder ?? 0]
    );
    return result.rows[0];
  }

  static async update(
    id: string,
    input: Partial<{ name: string; description: string; iconUrl: string; isActive: boolean; sortOrder: number }>
  ) {
    const result = await pool.query(
      `UPDATE public.exam_categories
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           icon_url = COALESCE($4, icon_url),
           is_active = COALESCE($5, is_active),
           sort_order = COALESCE($6, sort_order)
       WHERE id = $1
       RETURNING *`,
      [id, input.name ?? null, input.description ?? null, input.iconUrl ?? null, input.isActive ?? null, input.sortOrder ?? null]
    );
    if (result.rows.length === 0) throw new Error('Exam category not found');
    return result.rows[0];
  }

  static async remove(id: string) {
    const result = await pool.query(`DELETE FROM public.exam_categories WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) throw new Error('Exam category not found');
  }
}

// ══════════════════════════════════════════════════════════
// Test Series
// ══════════════════════════════════════════════════════════

export class AdminTestSeriesCatalogService {
  static async list(examCategoryId?: string) {
    const result = await pool.query(
      `SELECT s.*, ec.name AS exam_category_name,
              COUNT(t.id)::int AS test_count
       FROM public.test_series s
       JOIN public.exam_categories ec ON ec.id = s.exam_category_id
       LEFT JOIN public.tests t ON t.test_series_id = s.id AND t.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND ($1::uuid IS NULL OR s.exam_category_id = $1)
       GROUP BY s.id, ec.name
       ORDER BY s.created_at DESC`,
      [examCategoryId ?? null]
    );
    return result.rows;
  }

  static async get(id: string) {
    const result = await pool.query(
      `SELECT s.*, ec.name AS exam_category_name
       FROM public.test_series s
       JOIN public.exam_categories ec ON ec.id = s.exam_category_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) throw new Error('Test series not found');
    return result.rows[0];
  }

  static async create(input: {
    examCategoryId: string;
    slug?: string;
    title: string;
    description?: string;
    year?: number;
    isFree?: boolean;
    price?: number;
  }) {
    const slug = input.slug?.trim() || slugify(`${input.title}-${input.year ?? ''}`);
    const result = await pool.query(
      `INSERT INTO public.test_series (exam_category_id, slug, title, description, year, is_free, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.examCategoryId,
        slug,
        input.title,
        input.description ?? null,
        input.year ?? null,
        input.isFree ?? false,
        input.price ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async update(
    id: string,
    input: Partial<{
      title: string;
      description: string;
      year: number;
      isFree: boolean;
      price: number;
      isPublished: boolean;
    }>
  ) {
    const result = await pool.query(
      `UPDATE public.test_series
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           year = COALESCE($4, year),
           is_free = COALESCE($5, is_free),
           price = COALESCE($6, price),
           is_published = COALESCE($7, is_published)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        input.title ?? null,
        input.description ?? null,
        input.year ?? null,
        input.isFree ?? null,
        input.price ?? null,
        input.isPublished ?? null,
      ]
    );
    if (result.rows.length === 0) throw new Error('Test series not found');
    return result.rows[0];
  }

  static async remove(id: string) {
    const result = await pool.query(
      `UPDATE public.test_series SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) throw new Error('Test series not found');
  }
}

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

export class AdminTestsService {
  static async list(testSeriesId?: string) {
    const result = await pool.query(
      `SELECT t.*, COUNT(tq.id)::int AS question_count
       FROM public.tests t
       LEFT JOIN public.test_questions tq ON tq.test_id = t.id
       WHERE t.deleted_at IS NULL AND ($1::uuid IS NULL OR t.test_series_id = $1)
       GROUP BY t.id
       ORDER BY t.sort_order ASC, t.created_at DESC`,
      [testSeriesId ?? null]
    );
    return result.rows;
  }

  static async get(id: string) {
    const testResult = await pool.query(`SELECT * FROM public.tests WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (testResult.rows.length === 0) throw new Error('Test not found');

    const sectionsResult = await pool.query(
      `SELECT * FROM public.test_sections WHERE test_id = $1 ORDER BY sort_order ASC`,
      [id]
    );

    const questionsResult = await pool.query(
      `SELECT tq.id AS test_question_id, tq.section_id, tq.sort_order,
              q.id, q.question_type, q.body, q.options, q.correct_options,
              q.nat_answer, q.nat_tolerance, q.marks, q.negative_marks,
              q.topic, q.difficulty, q.explanation
       FROM public.test_questions tq
       JOIN public.testseries_questions q ON q.id = tq.question_id
       WHERE tq.test_id = $1
       ORDER BY tq.sort_order ASC`,
      [id]
    );

    return { ...testResult.rows[0], sections: sectionsResult.rows, questions: questionsResult.rows };
  }

  static async create(input: {
    testSeriesId?: string;
    slug?: string;
    title: string;
    instructions?: string;
    durationSeconds: number;
    isSectional?: boolean;
    sectionTimeLocked?: boolean;
    isFree?: boolean;
    releaseAt?: string;
    sortOrder?: number;
  }) {
    const slug = input.slug?.trim() || slugify(`${input.title}-${Date.now()}`);
    const result = await pool.query(
      `INSERT INTO public.tests
         (test_series_id, slug, title, instructions, duration_seconds, is_sectional, section_time_locked, is_free, release_at, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.testSeriesId ?? null,
        slug,
        input.title,
        input.instructions ?? null,
        input.durationSeconds,
        input.isSectional ?? false,
        input.sectionTimeLocked ?? false,
        input.isFree ?? false,
        input.releaseAt ?? null,
        input.sortOrder ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async update(
    id: string,
    input: Partial<{
      title: string;
      instructions: string;
      durationSeconds: number;
      isSectional: boolean;
      sectionTimeLocked: boolean;
      isFree: boolean;
      releaseAt: string | null;
      isPublished: boolean;
      sortOrder: number;
    }>
  ) {
    const result = await pool.query(
      `UPDATE public.tests
       SET title = COALESCE($2, title),
           instructions = COALESCE($3, instructions),
           duration_seconds = COALESCE($4, duration_seconds),
           is_sectional = COALESCE($5, is_sectional),
           section_time_locked = COALESCE($6, section_time_locked),
           is_free = COALESCE($7, is_free),
           release_at = COALESCE($8, release_at),
           is_published = COALESCE($9, is_published),
           sort_order = COALESCE($10, sort_order)
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        input.title ?? null,
        input.instructions ?? null,
        input.durationSeconds ?? null,
        input.isSectional ?? null,
        input.sectionTimeLocked ?? null,
        input.isFree ?? null,
        input.releaseAt ?? null,
        input.isPublished ?? null,
        input.sortOrder ?? null,
      ]
    );
    if (result.rows.length === 0) throw new Error('Test not found');
    return result.rows[0];
  }

  static async remove(id: string) {
    const result = await pool.query(
      `UPDATE public.tests SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) throw new Error('Test not found');
  }

  // ── Sections ──

  static async addSection(testId: string, input: { name: string; durationSeconds?: number; sortOrder?: number }) {
    const result = await pool.query(
      `INSERT INTO public.test_sections (test_id, name, duration_seconds, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [testId, input.name, input.durationSeconds ?? null, input.sortOrder ?? 0]
    );
    return result.rows[0];
  }

  static async updateSection(sectionId: string, input: Partial<{ name: string; durationSeconds: number; sortOrder: number }>) {
    const result = await pool.query(
      `UPDATE public.test_sections
       SET name = COALESCE($2, name),
           duration_seconds = COALESCE($3, duration_seconds),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $1 RETURNING *`,
      [sectionId, input.name ?? null, input.durationSeconds ?? null, input.sortOrder ?? null]
    );
    if (result.rows.length === 0) throw new Error('Section not found');
    return result.rows[0];
  }

  static async removeSection(sectionId: string) {
    const result = await pool.query(`DELETE FROM public.test_sections WHERE id = $1 RETURNING id`, [sectionId]);
    if (result.rows.length === 0) throw new Error('Section not found');
  }

  // ── Question assignment ──

  static async attachQuestion(testId: string, input: { questionId: string; sectionId?: string | null }) {
    const nextOrderResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM public.test_questions WHERE test_id = $1`,
      [testId]
    );
    const result = await pool.query(
      `INSERT INTO public.test_questions (test_id, question_id, section_id, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (test_id, question_id) DO UPDATE SET section_id = EXCLUDED.section_id
       RETURNING *`,
      [testId, input.questionId, input.sectionId ?? null, nextOrderResult.rows[0].next_order]
    );
    return result.rows[0];
  }

  static async detachQuestion(testId: string, questionId: string) {
    const result = await pool.query(
      `DELETE FROM public.test_questions WHERE test_id = $1 AND question_id = $2 RETURNING id`,
      [testId, questionId]
    );
    if (result.rows.length === 0) throw new Error('Question is not attached to this test');
  }

  static async reorderQuestions(testId: string, orderedQuestionIds: string[]) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < orderedQuestionIds.length; i++) {
        await client.query(
          `UPDATE public.test_questions SET sort_order = $3 WHERE test_id = $1 AND question_id = $2`,
          [testId, orderedQuestionIds[i], i]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// ══════════════════════════════════════════════════════════
// Question Bank
// ══════════════════════════════════════════════════════════

export interface QuestionBankFilters {
  search?: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
  page?: number;
  limit?: number;
}

export class AdminQuestionBankService {
  static async list(filters: QuestionBankFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 25, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`body ILIKE $${params.length}`);
    }
    if (filters.topic) {
      params.push(filters.topic);
      conditions.push(`topic = $${params.length}`);
    }
    if (filters.difficulty) {
      params.push(filters.difficulty);
      conditions.push(`difficulty = $${params.length}`);
    }
    if (filters.questionType) {
      params.push(filters.questionType);
      conditions.push(`question_type = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM public.testseries_questions ${where}`, params);
    params.push(limit, offset);
    const rowsResult = await pool.query(
      `SELECT * FROM public.testseries_questions ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      questions: rowsResult.rows,
      pagination: { page, limit, total: countResult.rows[0].total, totalPages: Math.ceil(countResult.rows[0].total / limit) },
    };
  }

  static async get(id: string) {
    const result = await pool.query(`SELECT * FROM public.testseries_questions WHERE id = $1`, [id]);
    if (result.rows.length === 0) throw new Error('Question not found');
    return result.rows[0];
  }

  static async create(input: {
    questionType: 'mcq' | 'msq' | 'nat';
    body: string;
    options?: { id: string; text: string }[];
    correctOptions?: string[];
    natAnswer?: number;
    natTolerance?: number;
    marks?: number;
    negativeMarks?: number;
    topic?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    explanation?: string;
  }) {
    const result = await pool.query(
      `INSERT INTO public.testseries_questions
         (question_type, body, options, correct_options, nat_answer, nat_tolerance, marks, negative_marks, topic, difficulty, explanation)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.questionType,
        input.body,
        input.options ? JSON.stringify(input.options) : null,
        input.correctOptions ? JSON.stringify(input.correctOptions) : null,
        input.natAnswer ?? null,
        input.natTolerance ?? 0,
        input.marks ?? 1,
        input.negativeMarks ?? 0,
        input.topic ?? null,
        input.difficulty ?? null,
        input.explanation ?? null,
      ]
    );
    return result.rows[0];
  }

  static async update(
    id: string,
    input: Partial<{
      body: string;
      options: { id: string; text: string }[];
      correctOptions: string[];
      natAnswer: number;
      natTolerance: number;
      marks: number;
      negativeMarks: number;
      topic: string;
      difficulty: 'easy' | 'medium' | 'hard';
      explanation: string;
    }>
  ) {
    const result = await pool.query(
      `UPDATE public.testseries_questions
       SET body = COALESCE($2, body),
           options = COALESCE($3::jsonb, options),
           correct_options = COALESCE($4::jsonb, correct_options),
           nat_answer = COALESCE($5, nat_answer),
           nat_tolerance = COALESCE($6, nat_tolerance),
           marks = COALESCE($7, marks),
           negative_marks = COALESCE($8, negative_marks),
           topic = COALESCE($9, topic),
           difficulty = COALESCE($10, difficulty),
           explanation = COALESCE($11, explanation)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.body ?? null,
        input.options ? JSON.stringify(input.options) : null,
        input.correctOptions ? JSON.stringify(input.correctOptions) : null,
        input.natAnswer ?? null,
        input.natTolerance ?? null,
        input.marks ?? null,
        input.negativeMarks ?? null,
        input.topic ?? null,
        input.difficulty ?? null,
        input.explanation ?? null,
      ]
    );
    if (result.rows.length === 0) throw new Error('Question not found');
    return result.rows[0];
  }

  static async remove(id: string) {
    const result = await pool.query(`DELETE FROM public.testseries_questions WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) throw new Error('Question not found');
  }

  static async listTopics(): Promise<string[]> {
    const result = await pool.query(
      `SELECT DISTINCT topic FROM public.testseries_questions WHERE topic IS NOT NULL ORDER BY topic ASC`
    );
    return result.rows.map((r) => r.topic);
  }
}
