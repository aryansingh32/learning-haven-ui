# CLAUDE.md

Monorepo for **Forge** (learner platform) and **Forge Campus** (college LMS/assessments). pnpm 9 + turbo.

**Start here when resuming work:** read `docs/campus/HANDOFF.md` — current state, branch merge order,
live-database state, architecture rules, how to test, and the next tasks (Slice E: student exam screen).

Key rules:
- Work on `feat/campus-phase-1` (stacked on `feat/campus-phase-0` and `chore/launch-fixes-and-test-series`).
  Don't run/deploy the Forge API from `main` until those are merged — the live DB is already locked down.
- Campus API: user requests go through `asUser` (RLS decides); `asSystem` only after access is proven, by explicit id.
- New DB changes: test locally with `pnpm --filter @repo/api test:db` (disposable Postgres 17, never a Supabase URL),
  add checks to `apps/api/supabase/tests/*.sql`, then apply to Supabase project `wxrxnqhjkwlxvmaopvlv` and verify.
- Never put secrets in the repo; env files are gitignored (see each app's `.env.example`).
