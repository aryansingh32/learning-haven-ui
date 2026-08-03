-- Add celebration tracking to build_enrollments
ALTER TABLE build_enrollments ADD COLUMN IF NOT EXISTS celebrated_stages INTEGER[] DEFAULT '{}';

-- Add manual override fields to build_stage_results  
ALTER TABLE build_stage_results ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT FALSE;
ALTER TABLE build_stage_results ADD COLUMN IF NOT EXISTS overridden_by_admin_id UUID;
