-- Create enum for problem status
CREATE TYPE problem_status AS ENUM ('solved', 'tried', 'revision');

-- Create user_problem_status table
CREATE TABLE IF NOT EXISTS public.user_problem_status (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    status problem_status NOT NULL,
    solved_at TIMESTAMPTZ,
    time_spent INTEGER DEFAULT 0, -- in seconds
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, problem_id)
);

-- Create user_notes table
CREATE TABLE IF NOT EXISTS public.user_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    content TEXT, -- Markdown content
    pattern_notes TEXT,
    mistake_log JSONB, -- Structured mistake log
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, problem_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_problem_status_user_id ON public.user_problem_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_problem_status_problem_id ON public.user_problem_status(problem_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_problem_id ON public.user_notes(problem_id);

-- Add RLS policies (Ensure RLS is enabled on these tables if not already)
ALTER TABLE public.user_problem_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Policies for user_problem_status
CREATE POLICY "Users can view their own problem status" 
ON public.user_problem_status FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own problem status" 
ON public.user_problem_status FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own problem status" 
ON public.user_problem_status FOR UPDATE 
USING (auth.uid() = user_id);

-- Policies for user_notes
CREATE POLICY "Users can view their own notes" 
ON public.user_notes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" 
ON public.user_notes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
ON public.user_notes FOR UPDATE 
USING (auth.uid() = user_id);
