-- User resumes table for server-side resume persistence (BUG-007)
CREATE TABLE IF NOT EXISTS public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own resume"
  ON public.user_resumes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_resumes_user_id ON public.user_resumes(user_id);
