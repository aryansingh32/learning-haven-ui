-- Add study time tracking to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS study_time_total BIGINT DEFAULT 0 CHECK (study_time_total >= 0),
ADD COLUMN IF NOT EXISTS last_study_session TIMESTAMPTZ;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_users_study_time ON public.users(study_time_total DESC);
