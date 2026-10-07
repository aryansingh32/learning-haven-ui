-- ============================================================
-- Migration: Test Series Core (standalone CBT engine)
-- Purpose: Exam-agnostic Computer-Based Testing engine, entirely
--          separate from the course quiz engine (mock_test_attempts,
--          chapter_content.quiz). Powers the test-series marketplace:
--          exam_categories -> test_series -> tests -> questions.
--          Server-authoritative attempts (expires_at set once at
--          start; autosave writes are rejected past expiry).
-- ============================================================

-- ------------------------------------------------------------
-- Catalog: exam_categories -> test_series -> tests
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exam_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_series (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_category_id UUID NOT NULL REFERENCES public.exam_categories(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT,
  year             INTEGER,
  is_free          BOOLEAN NOT NULL DEFAULT false,
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_published     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_test_series_category ON public.test_series(exam_category_id);

CREATE TABLE IF NOT EXISTS public.tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id      UUID REFERENCES public.test_series(id) ON DELETE CASCADE, -- nullable: standalone tests
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  instructions        TEXT,
  duration_seconds    INTEGER NOT NULL CHECK (duration_seconds > 0),
  is_sectional        BOOLEAN NOT NULL DEFAULT false,
  section_time_locked BOOLEAN NOT NULL DEFAULT false,
  is_free             BOOLEAN NOT NULL DEFAULT false,
  release_at          TIMESTAMPTZ, -- drip-release scheduling
  is_published        BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tests_series ON public.tests(test_series_id, sort_order);

CREATE TABLE IF NOT EXISTS public.test_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER, -- only meaningful when tests.section_time_locked = true
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_sections_test ON public.test_sections(test_id, sort_order);

-- ------------------------------------------------------------
-- Question bank: typed columns, not loose JSON (avoids the
-- chapter_content.quiz jsonb schema-drift problem).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.question_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stimulus   TEXT NOT NULL, -- shared passage / comprehension context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.testseries_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_group_id UUID REFERENCES public.question_groups(id) ON DELETE SET NULL,
  question_type     TEXT NOT NULL CHECK (question_type IN ('mcq', 'msq', 'nat')),
  body              TEXT NOT NULL,
  -- mcq/msq only: options = [{id, text}], correct_options = [optionId, ...] (mcq has exactly one)
  options           JSONB,
  correct_options   JSONB,
  -- nat only: exact/tolerance-range numeric grading
  nat_answer        NUMERIC,
  nat_tolerance     NUMERIC NOT NULL DEFAULT 0,
  marks             NUMERIC(6,2) NOT NULL DEFAULT 1,
  negative_marks    NUMERIC(6,2) NOT NULL DEFAULT 0,
  topic             TEXT,
  difficulty        TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  explanation       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_mcq_msq_options CHECK (
    question_type = 'nat' OR (options IS NOT NULL AND correct_options IS NOT NULL)
  ),
  CONSTRAINT chk_nat_answer CHECK (
    question_type <> 'nat' OR nat_answer IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_testseries_questions_topic ON public.testseries_questions(topic);

CREATE TABLE IF NOT EXISTS public.test_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id     UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.testseries_questions(id) ON DELETE CASCADE,
  section_id  UUID REFERENCES public.test_sections(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (test_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_test_questions_test ON public.test_questions(test_id, sort_order);

-- ------------------------------------------------------------
-- Attempts: server-authoritative timing + per-question autosave.
-- expires_at is set once at creation and never trusted from the
-- client; autosave writes past expires_at must be rejected by the
-- application layer, and submission always scores the last saved
-- server-side state rather than any client-submitted answer payload.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.test_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  test_id         UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  submitted_at    TIMESTAMPTZ,
  -- Per-question autosaved state:
  -- [{ question_id, status: 'not_visited'|'visited'|'answered'|'marked_for_review'|'answered_marked',
  --    selected_options: [optionId,...] | null, nat_value: number | null, updated_at }]
  answers         JSONB NOT NULL DEFAULT '[]'::jsonb,
  score           NUMERIC(8,2),
  correct_count   INTEGER,
  total_questions INTEGER NOT NULL,
  total_marks     NUMERIC(8,2) NOT NULL,
  percentile      NUMERIC(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test ON public.test_attempts(user_id, test_id, created_at DESC);

-- Only one in-progress attempt per user per test at a time (resume, not duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS uq_test_attempts_in_progress
  ON public.test_attempts(user_id, test_id) WHERE status = 'in_progress';

COMMENT ON TABLE public.test_attempts IS
  'Standalone CBT attempts. expires_at is server-set at start and authoritative; never derived from client-reported time.';

-- ------------------------------------------------------------
-- updated_at triggers (reuses the shared function from init migration)
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_exam_categories_updated_at ON public.exam_categories;
CREATE TRIGGER trg_exam_categories_updated_at
  BEFORE UPDATE ON public.exam_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_series_updated_at ON public.test_series;
CREATE TRIGGER trg_test_series_updated_at
  BEFORE UPDATE ON public.test_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_tests_updated_at ON public.tests;
CREATE TRIGGER trg_tests_updated_at
  BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_testseries_questions_updated_at ON public.testseries_questions;
CREATE TRIGGER trg_testseries_questions_updated_at
  BEFORE UPDATE ON public.testseries_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_test_attempts_updated_at ON public.test_attempts;
CREATE TRIGGER trg_test_attempts_updated_at
  BEFORE UPDATE ON public.test_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

ALTER TABLE public.exam_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active exam categories" ON public.exam_categories;
CREATE POLICY "Public read active exam categories" ON public.exam_categories
  FOR SELECT USING (is_active = true);

ALTER TABLE public.test_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read published test series" ON public.test_series;
CREATE POLICY "Public read published test series" ON public.test_series
  FOR SELECT USING (is_published = true AND deleted_at IS NULL);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read published tests" ON public.tests;
CREATE POLICY "Public read published tests" ON public.tests
  FOR SELECT USING (
    is_published = true AND deleted_at IS NULL AND (release_at IS NULL OR release_at <= NOW())
  );

-- Question bank tables carry correct answers: default-deny for anon/authenticated
-- roles. The API serves questions (with answers stripped) via the service-level
-- `pool` connection, matching the pattern already used by mock-test/chapters.
ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testseries_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own attempts" ON public.test_attempts;
CREATE POLICY "Users manage own attempts" ON public.test_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
