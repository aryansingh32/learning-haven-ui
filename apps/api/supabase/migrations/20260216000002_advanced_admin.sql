-- ============================================
-- Advanced Admin Panel Migration
-- Categories, Patterns, Tasks, Roadmaps,
-- Dynamic Plans, System Settings, Feedback
-- ============================================

-- ============================================
-- Categories (e.g. Arrays, Trees, Graphs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  problem_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_order ON public.categories(order_index);

-- ============================================
-- Patterns (e.g. Two Pointers, Sliding Window)
-- Belongs to a Category
-- ============================================
CREATE TABLE IF NOT EXISTS public.patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  problem_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, name)
);

DROP TRIGGER IF EXISTS patterns_updated_at ON public.patterns;
CREATE TRIGGER patterns_updated_at
  BEFORE UPDATE ON public.patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_patterns_category ON public.patterns(category_id);
CREATE INDEX IF NOT EXISTS idx_patterns_slug ON public.patterns(slug);

-- ============================================
-- Problem ↔ Pattern (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.problem_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(problem_id, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_pp_problem ON public.problem_patterns(problem_id);
CREATE INDEX IF NOT EXISTS idx_pp_pattern ON public.problem_patterns(pattern_id);

-- ============================================
-- Tasks (User to-do / daily task system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('custom', 'problem', 'roadmap', 'admin_assigned')),

  -- Links
  problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
  roadmap_id UUID,  -- filled after roadmaps table exists

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Scheduling
  due_date DATE,
  completed_at TIMESTAMPTZ,

  -- Admin assigning
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_admin_assigned BOOLEAN DEFAULT FALSE,

  -- XP reward
  xp_reward INTEGER DEFAULT 10,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON public.tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(user_id, status);

-- ============================================
-- Roadmaps (90-day, 30-day revision, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('zero_to_hero', 'revision', 'topic_wise', 'company_wise', 'custom')),
  duration_days INTEGER,                  -- e.g. 90, 30
  difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'mixed')),
  cover_image TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  item_count INTEGER DEFAULT 0,
  enrolled_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS roadmaps_updated_at ON public.roadmaps;
CREATE TRIGGER roadmaps_updated_at
  BEFORE UPDATE ON public.roadmaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_roadmaps_slug ON public.roadmaps(slug);
CREATE INDEX IF NOT EXISTS idx_roadmaps_type ON public.roadmaps(type);

-- ============================================
-- Roadmap Items (ordered problems within a roadmap)
-- ============================================
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,

  -- Item details
  day_number INTEGER NOT NULL,           -- Day 1, Day 2...
  title TEXT NOT NULL,                   -- Override or section name
  description TEXT,
  section TEXT,                          -- "Week 1: Basics", "Phase 2: Trees"
  order_index INTEGER NOT NULL DEFAULT 0,
  is_milestone BOOLEAN DEFAULT FALSE,    -- Mark as checkpoint

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_items_roadmap ON public.roadmap_items(roadmap_id, order_index);

-- Add roadmap FK to tasks now that roadmaps exists
ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_roadmap
  FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id) ON DELETE SET NULL;

-- ============================================
-- Plans Config (dynamic, replaces hardcoded)
-- ============================================
CREATE TABLE IF NOT EXISTS public.plans_config (
  id TEXT PRIMARY KEY,                   -- 'basic-monthly', 'pro-yearly'
  name TEXT NOT NULL,
  price INTEGER NOT NULL,                -- in paise
  currency TEXT DEFAULT 'INR',
  interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly', 'lifetime')),
  features JSONB DEFAULT '[]',
  problem_access TEXT DEFAULT 'basic',   -- 'free', 'basic', 'pro'
  ai_queries_limit INTEGER DEFAULT 50,   -- -1 = unlimited
  free_question_limit INTEGER DEFAULT 20,-- how many free questions
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS plans_config_updated_at ON public.plans_config;
CREATE TRIGGER plans_config_updated_at
  BEFORE UPDATE ON public.plans_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed default plans
INSERT INTO public.plans_config (id, name, price, currency, interval, features, problem_access, ai_queries_limit, free_question_limit, order_index) VALUES
('basic-monthly', 'Basic Monthly', 29900, 'INR', 'monthly',
 '["All free problems", "Hints for all problems", "Basic AI coach (50 queries/month)", "Progress tracking"]',
 'basic', 50, 20, 1),
('basic-yearly', 'Basic Yearly', 249900, 'INR', 'yearly',
 '["All Basic Monthly features", "Save 30% vs monthly"]',
 'basic', 50, 20, 2),
('pro-monthly', 'Pro Monthly', 59900, 'INR', 'monthly',
 '["All problems including premium", "Full solutions with explanations", "Unlimited AI coach", "Priority support", "Certificates", "Company-wise problem sets"]',
 'pro', -1, -1, 3),
('pro-yearly', 'Pro Yearly', 499900, 'INR', 'yearly',
 '["All Pro Monthly features", "Save 30% vs monthly"]',
 'pro', -1, -1, 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- System Settings (global key-value config)
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',       -- general, payment, ai, premium, referral
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.system_settings (key, value, description, category) VALUES
('free_question_limit', '20', 'Max free questions before premium required', 'premium'),
('gst_rate', '0.18', 'GST rate for digital services (18%)', 'payment'),
('ai_model', '"gpt-4o-mini"', 'Default AI model for coach', 'ai'),
('ai_temperature', '0.7', 'AI response temperature', 'ai'),
('ai_max_tokens', '1500', 'Max tokens per AI response', 'ai'),
('referral_reward_amount', '50', 'Reward per successful referral (INR)', 'referral'),
('referral_min_withdrawal', '100', 'Minimum withdrawal amount (INR)', 'referral'),
('leaderboard_visible_count', '100', 'Number of users shown on leaderboard', 'general'),
('maintenance_mode', 'false', 'Enable maintenance mode', 'general'),
('signup_enabled', 'true', 'Allow new user registrations', 'general')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Feedback
-- ============================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'bug', 'feature', 'content', 'ui')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'in_progress', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS feedback_updated_at ON public.feedback;
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);

-- ============================================
-- RLS for new tables
-- ============================================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks"
  ON public.tasks FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view admin-assigned tasks" ON public.tasks;
CREATE POLICY "Users can view admin-assigned tasks"
  ON public.tasks FOR SELECT
  USING (is_admin_assigned = TRUE AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback;
CREATE POLICY "Users can manage own feedback"
  ON public.feedback FOR ALL
  USING (auth.uid() = user_id);
