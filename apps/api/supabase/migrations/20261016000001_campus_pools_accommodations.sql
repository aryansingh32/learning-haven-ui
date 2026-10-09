-- =============================================================================
-- Forge Campus — question pools and accommodations (slice B2)
--
-- * Pools: a section (or the unsectioned part of a test) can deal N of its M
--   questions to each student, chosen per attempt. Different students get
--   different questions; the Campus API keeps a pool's marks equal so totals
--   stay comparable.
-- * Accommodations: extra time for named students on an assignment (e.g. 25%
--   for a student with a disability). Applied when the attempt starts, to the
--   whole test and to each timed section; may run past the closing time by the
--   same amount. Composite keys keep the student, the assignment and the
--   college the same.
--
-- Additive. Tested by supabase/tests/campus_assessments.sql.
-- =============================================================================

alter table public.test_sections
  add column if not exists draw_count integer check (draw_count is null or draw_count >= 1);
alter table public.tests
  add column if not exists draw_count integer check (draw_count is null or draw_count >= 1);  -- for questions not in a section

create table campus.assignment_accommodations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  assignment_id uuid not null,
  user_id       uuid not null,
  extra_percent integer not null check (extra_percent between 1 and 100),
  note          text check (note is null or length(note) <= 500),
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (assignment_id, user_id),
  foreign key (assignment_id, org_id) references campus.assignments(id, org_id) on delete cascade,
  foreign key (org_id, user_id) references campus.org_memberships(org_id, user_id) on delete cascade
);
alter table campus.assignment_accommodations enable row level security;

-- Staff who set up assignments manage accommodations; report viewers and
-- invigilators can see them; a student sees their own.
create policy accommodation_select on campus.assignment_accommodations for select to authenticated
  using (
    user_id = auth.uid()
    or campus.has_org_permission(org_id, 'assessments.create')
    or campus.has_org_permission(org_id, 'reports.view')
    or campus.has_org_permission(org_id, 'assessments.invigilate')
  );
create policy accommodation_write on campus.assignment_accommodations for all to authenticated
  using (campus.has_org_permission(org_id, 'assessments.create'))
  with check (campus.has_org_permission(org_id, 'assessments.create'));

grant select, insert, update, delete on campus.assignment_accommodations to authenticated;
grant all on campus.assignment_accommodations to service_role;
