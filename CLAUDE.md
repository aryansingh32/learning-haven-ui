# CLAUDE.md

Monorepo for **Forge** (learner platform) and **Forge Campus** (college LMS/assessments). pnpm 9 + turbo.

**Start here when resuming work:** read `docs/CONTEXT.md` (one-page summary: what we're doing, done, left, where the docs are), then `docs/campus/HANDOFF.md` — current state, branch merge order,
live-database state, architecture rules, how to test, and what's left (next: slice B1, coding questions in Campus tests).
Then `docs/campus/BUILD_PLAN.md` (build order) and `docs/campus/FEATURE_CHECKLIST.md` (status of every feature).

Key rules:
- Work on `ccr-f94ce2b7-q10f2w` (stacked on `feat/campus-phase-1` → `feat/campus-phase-0` → `chore/launch-fixes-and-test-series`).
  Don't run/deploy the Forge API from `main` until those are merged — the live DB is already locked down.
- Campus API: user requests go through `asUser` (RLS decides); `asSystem` only after access is proven, by explicit id.
- New DB changes: test locally with `pnpm --filter @repo/api test:db` (disposable Postgres 17, never a Supabase URL),
  add checks to `apps/api/supabase/tests/*.sql`, then apply to Supabase project `wxrxnqhjkwlxvmaopvlv` and verify.
- Never put secrets in the repo; env files are gitignored (see each app's `.env.example`).
- Shared judging/scoring rules live in `packages/assessment-core` (web imports its source via a Vite/tsconfig alias).
- Owner prefers: proceed autonomously on agreed plans, small verified commits, ask before production-affecting steps.
