-- =============================================
-- Build Haven: Stage short_id + randomization_config + celebrated_stages
-- =============================================

-- 1. Add short_id column to build_stages for stable URL references
ALTER TABLE build_stages
  ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Generate short_ids for existing stages that don't have one
UPDATE build_stages
  SET short_id = upper(substr(md5(random()::text), 1, 3))
  WHERE short_id IS NULL;

-- Make short_id NOT NULL with a default for future inserts
ALTER TABLE build_stages
  ALTER COLUMN short_id SET DEFAULT upper(substr(md5(random()::text), 1, 3));

ALTER TABLE build_stages
  ALTER COLUMN short_id SET NOT NULL;

-- Add unique constraint per program for short_id
CREATE UNIQUE INDEX IF NOT EXISTS build_stages_program_short_id_idx
  ON build_stages (program_id, short_id);

-- 2. Add randomization_config column for template variable injection
ALTER TABLE build_stages
  ADD COLUMN IF NOT EXISTS randomization_config JSONB DEFAULT NULL;

COMMENT ON COLUMN build_stages.randomization_config IS
  'Template variable config for randomized test inputs. Example: {"random_fruit": {"type": "random_choice", "values": ["apple", "banana", "mango"]}}';

-- 3. Add celebrated_stages to build_enrollments for tracking the two-step modal
ALTER TABLE build_enrollments
  ADD COLUMN IF NOT EXISTS celebrated_stages INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN build_enrollments.celebrated_stages IS
  'Stage numbers where the user has consciously clicked "Mark as Complete" in the two-step modal';
