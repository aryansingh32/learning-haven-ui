-- Policies for build_stages: Admins can perform all actions
drop policy if exists "Admins can manage build stages" on public.build_stages;
create policy "Admins can manage build stages"
  on public.build_stages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('admin', 'super_admin')
    )
  );

-- Policies for build_challenge_languages: Admins can perform all actions
drop policy if exists "Admins can manage build challenge languages" on public.build_challenge_languages;
create policy "Admins can manage build challenge languages"
  on public.build_challenge_languages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('admin', 'super_admin')
    )
  );
