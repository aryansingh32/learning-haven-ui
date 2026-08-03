-- Daily quests & gamification support
CREATE TABLE IF NOT EXISTS public.user_daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quests JSONB NOT NULL DEFAULT '[]'::jsonb,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_quests_user_date
  ON public.user_daily_quests(user_id, quest_date DESC);

-- Streak recovery tokens
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER NOT NULL DEFAULT 1;

-- Seed gamification config (upsert-safe)
INSERT INTO public.system_settings (key, value, description, category)
VALUES (
  'gamification_config',
  '{
    "identity_titles": [
      { "id": "novice", "minLevel": 1, "maxLevel": 5, "title": "Novice Coder", "requiredChapterTags": [] },
      { "id": "explorer", "minLevel": 6, "maxLevel": 10, "title": "Algorithm Explorer", "requiredChapterTags": [] },
      { "id": "hunter", "minLevel": 11, "maxLevel": 20, "title": "Problem Hunter", "requiredChapterTags": [] },
      { "id": "pattern_master", "minLevel": 21, "maxLevel": 35, "title": "Pattern Master", "requiredChapterTags": ["arrays", "strings", "hashing"] },
      { "id": "warrior", "minLevel": 36, "maxLevel": 50, "title": "Interview Warrior", "requiredChapterTags": ["recursion", "trees", "graphs"] },
      { "id": "architect", "minLevel": 51, "maxLevel": 999, "title": "Backend Architect", "requiredChapterTags": ["system-design"] }
    ],
    "badges": [
      { "id": "array_assassin", "name": "Array Assassin", "emoji": "⚔️", "topicTag": "arrays", "solveCount": 25 },
      { "id": "binary_search_sniper", "name": "Binary Search Sniper", "emoji": "🎯", "topicTag": "binary-search", "solveCount": 15 },
      { "id": "hashmap_wizard", "name": "HashMap Wizard", "emoji": "🧙", "topicTag": "hashing", "solveCount": 20 },
      { "id": "recursion_survivor", "name": "Recursion Survivor", "emoji": "🌀", "topicTag": "recursion", "solveCount": 20 },
      { "id": "sliding_window_specialist", "name": "Sliding Window Specialist", "emoji": "🪟", "topicTag": "sliding-window", "solveCount": 15 },
      { "id": "graph_explorer", "name": "Graph Explorer", "emoji": "🗺️", "topicTag": "graphs", "solveCount": 20 },
      { "id": "tree_tamer", "name": "Tree Tamer", "emoji": "🌳", "topicTag": "trees", "solveCount": 20 },
      { "id": "stack_samurai", "name": "Stack Samurai", "emoji": "⛩️", "topicTag": "stacks", "solveCount": 15 }
    ],
    "daily_quest_templates": [
      { "key": "read_concept", "label": "Read 1 Concept", "xp": 15 },
      { "key": "solve_problem", "label": "Solve 1 Problem", "xp": 25 },
      { "key": "complete_challenge", "label": "Complete 1 Mini Challenge", "xp": 10 }
    ],
    "daily_quest_bonus_xp": 50,
    "weekly_goal_problems": 10,
    "monthly_goal_label": "Finish current module"
  }'::jsonb,
  'Identity titles, badges, and daily quest configuration',
  'gamification'
)
ON CONFLICT (key) DO NOTHING;
