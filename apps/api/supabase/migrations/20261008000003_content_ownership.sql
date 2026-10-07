-- =============================================================================
-- Forge Campus — content ownership (Phase 0)
--
-- Courses, tests, build challenges and their categories gain an owner
-- organisation and a visibility. Defaults make every existing row Forge-owned
-- and as visible as today, so the current app is unaffected; college content
-- will set owner_org_id to the college.
--
--   public  — anyone (today's Forge catalogue)
--   org     — members of the owner organisation
--   batch   — only batches it is assigned to (Phase 1 assignments)
--   private — the owner organisation's staff
-- =============================================================================

create type public.content_visibility as enum ('public', 'org', 'batch', 'private');

do $$
declare
  t text;
  forge constant uuid := '00000000-0000-0000-0000-00000000f0f0';
begin
  foreach t in array array[
    'courses', 'test_series', 'tests', 'programs', 'exam_categories', 'categories'
  ] loop
    execute format(
      'alter table public.%I
         add column owner_org_id uuid not null default %L references campus.organizations(id),
         add column visibility public.content_visibility not null default ''public''',
      t, forge);
    execute format('create index %I on public.%I (owner_org_id)', t || '_owner_org', t);
  end loop;
end $$;

-- Question-bank items are never browsable by learners; they default to the
-- owner's staff only.
alter table public.testseries_questions
  add column owner_org_id uuid not null default '00000000-0000-0000-0000-00000000f0f0' references campus.organizations(id),
  add column visibility public.content_visibility not null default 'private';
create index testseries_questions_owner_org on public.testseries_questions (owner_org_id);
