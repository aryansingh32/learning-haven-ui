import { Client } from 'pg';

async function fix() {
  const client = new Client({
    connectionString: "postgresql://postgres:adminDSAOSsupabase@db.wxrxnqhjkwlxvmaopvlv.supabase.co:5432/postgres"
  });
  await client.connect();

  const query = `
    -- Allow users to insert their own enrollments
    drop policy if exists "users can insert own build enrollments" on public.build_enrollments;
    create policy "users can insert own build enrollments"
      on public.build_enrollments for insert
      with check (auth.uid() = user_id);

    -- Allow users to update their own enrollments
    drop policy if exists "users can update own build enrollments" on public.build_enrollments;
    create policy "users can update own build enrollments"
      on public.build_enrollments for update
      using (auth.uid() = user_id);
      
    -- Allow users to insert their own stage results
    drop policy if exists "users can insert own build results" on public.build_stage_results;
    create policy "users can insert own build results"
      on public.build_stage_results for insert
      with check (auth.uid() = user_id);

    -- Allow users to update their own stage results
    drop policy if exists "users can update own build results" on public.build_stage_results;
    create policy "users can update own build results"
      on public.build_stage_results for update
      using (auth.uid() = user_id);
  `;

  try {
    await client.query(query);
    console.log("Successfully added RLS policies for insert/update.");
  } catch (e) {
    console.error("Failed to add RLS policies:", e);
  }

  await client.end();
}

fix();
