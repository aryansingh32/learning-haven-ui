-- ### 1. chapters
CREATE TABLE IF NOT EXISTS chapters (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id   UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title        TEXT NOT NULL,
  topic_tag    TEXT,
  difficulty   TEXT CHECK(difficulty IN ('BEGINNER','INTERMEDIATE','ADVANCED')) DEFAULT 'BEGINNER',
  story_hook   TEXT,
  whatsapp_msg TEXT,
  est_minutes  INTEGER DEFAULT 60,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(roadmap_id, chapter_number)
);

-- ### 2. chapter_content (one-to-one with chapters)
CREATE TABLE IF NOT EXISTS chapter_content (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id       UUID REFERENCES chapters(id) ON DELETE CASCADE UNIQUE,
  video_youtube_id TEXT,
  video_channel    TEXT,
  video_title      TEXT,
  video_duration   INTEGER,
  video_timestamps JSONB DEFAULT '[]',
  article_url      TEXT,
  article_source   TEXT,
  article_title    TEXT,
  problems         JSONB DEFAULT '[]',
  quiz             JSONB DEFAULT '[]',
  tasks            JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ### 3. user_chapter_progress
CREATE TABLE IF NOT EXISTS user_chapter_progress (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  chapter_id        UUID REFERENCES chapters(id) ON DELETE CASCADE,
  status            TEXT CHECK(status IN ('LOCKED','UNLOCKED','IN_PROGRESS','COMPLETED')) DEFAULT 'LOCKED',
  quiz_score        FLOAT,
  quiz_attempts     INTEGER DEFAULT 0,
  tasks_completed   INTEGER DEFAULT 0,
  used_skip_token   BOOLEAN DEFAULT false,
  unlocked_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);

-- ### 4. job_alerts
CREATE TABLE IF NOT EXISTS job_alerts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  type            TEXT CHECK(type IN ('JOB','INTERNSHIP','HACKATHON','SCHOLARSHIP')),
  apply_url       TEXT NOT NULL UNIQUE,
  deadline        TIMESTAMPTZ,
  stipend         TEXT,
  description     TEXT,
  tags            JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  posted_at       TIMESTAMPTZ DEFAULT now()
);

-- ### 5. user_badges
CREATE TABLE IF NOT EXISTS user_badges (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL,
  badge_name TEXT,
  badge_emoji TEXT,
  earned_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- ### 6. otp_verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  attempts    INTEGER DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ### 7. ADD COLUMNS TO EXISTING users TABLE
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skip_tokens_remaining INTEGER DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_answers JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_job_alerts BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS doubt_queries_used INTEGER DEFAULT 0;

-- ### 8. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_chapters_roadmap ON chapters(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_ucp_user ON user_chapter_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ucp_chapter ON user_chapter_progress(chapter_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON job_alerts(is_active, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_college ON users(college_name);
