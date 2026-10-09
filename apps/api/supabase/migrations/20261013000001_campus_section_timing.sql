-- =============================================================================
-- Forge Campus — timed, locked sections (slice B3)
--
-- * test_attempts remembers which section a locked attempt is in and when that
--   section's clock started. The Campus API advances it (pure rules in
--   assessment-core/sections.ts); students can't write attempts (RLS).
-- * A question can only be placed in a section of its own test.
-- * Section durations are sane (1 minute to 24 hours) when set.
--
-- Additive. Tested by supabase/tests/campus_assessments.sql.
-- =============================================================================

alter table public.test_attempts
  add column if not exists current_section    integer not null default 0 check (current_section >= 0),
  add column if not exists section_started_at timestamptz;

alter table public.test_sections
  drop constraint if exists test_sections_duration_check,
  add constraint test_sections_duration_check
    check (duration_seconds is null or duration_seconds between 60 and 86400) not valid;

create or replace function public.test_question_section_matches() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.test_sections s where s.id = new.section_id and s.test_id = new.test_id
  ) then
    raise exception 'That section belongs to a different test' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.test_question_section_matches() from public;

drop trigger if exists test_questions_section_matches on public.test_questions;
create trigger test_questions_section_matches
  before insert or update of section_id, test_id on public.test_questions
  for each row execute function public.test_question_section_matches();
