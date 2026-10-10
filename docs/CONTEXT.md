# Project context — read this first to resume work from anywhere

Last updated: 2026-10-10 · **Everything is merged into `main`**; the live database has every migration in the repo.
Work on feature branches off `main` (current: `feat/w2-account-learning`).

This file is the short version. It tells you what we are building, what we are doing right now, what is
done, what is left, and which document holds the details. When you finish a piece of work, update the
"Right now", "Done" and "Left" sections here, and the detailed docs listed at the end.

---

## 1. What we are building

A pnpm + turbo monorepo with two products that share one Supabase database (project `wxrxnqhjkwlxvmaopvlv`):

- **Forge**: a learning platform for students. It has courses and chapters, DSA practice with an in-app
  judge, test series, projects, a resume builder, jobs, gamification and paid plans (Razorpay).
  - Code: `apps/web` (React 18, port 5173) and `apps/api` (Express, `/api`).
- **Forge Campus**: an LMS and assessment product for colleges. It has departments, batches, rosters,
  tests (MCQ, coding and written), proctoring, invigilation, marking, analytics, placement drives and
  notifications.
  - Code: `apps/campus` (portal, port 5175) and `apps/campus-api` (`/campus/v1`, port 5100).
  - Students take college tests inside the Forge web app at `/college`.
- **Shared packages:**
  - `packages/assessment-core`: scoring, analytics, question sheets and rosters.
  - `packages/judge`: code runner and harnesses.

## 2. What we are doing right now

The owner's request was: **"Do the 260 partly-done features to fully done."** That means turning every 🟡 row in
`docs/campus/FEATURE_CHECKLIST.md` into ✅, full stack (database, API, UI), each verified.

The work goes in waves:

| Wave | Scope | State |
|---|---|---|
| C1–C3 | Campus partials: college structure; grading, analytics, activity log and roles; notifications and placement drives | ✅ done |
| W2 | Learner-side partials | 🔄 in progress (see below) |
| W3 | Admin control center: feature flags, maintenance mode, AI prompts, API keys, email config, queues, bulk user operations | ⏳ next |
| W4 | AI features (testable only with a stub model until a key is set) | ⏳ |
| W5 | Content drafts (problems, editorials, aptitude bank) for the owner's team to review | ⏳ |
| W6 | Infra and security (some steps are owner-only) | ⏳ |
| W7 | Accessibility (axe audit) | ⏳ |

W2 slices:

| Slice | What | State |
|---|---|---|
| W2-P1 | Practice: title search, company filter, problem of the day, editorials | ✅ |
| W2-D1 | Dashboard: goals, study time per day, assessment performance, activity feed | ✅ |
| W2-B1 | GST invoices, billing details, working order history | ✅ |
| W2-G1 | Gamification: weekly missions, coding streak, milestones, collections, leaderboard, daily XP limit | ✅ |
| W2-I1 | Coding workspace: diff, run history, custom input, memory, themes, formatters, phone layout | ✅ |
| W2-A1 | Account: active sessions, account log, email verification, skills, public portfolio | ✅ (2026-10-10, browser-verified) |
| W2-L1 | Learning: highlights, video speed, prerequisites, drip, export, discussions (+ admin learning settings) | ✅ (2026-10-10, browser-verified) |

**Immediate next step:** the rest of W2:
- placement readiness computed on the server
- course bundles
- certificate templates

Then W3.

## 3. Done (high level)

Checklist totals: **485 done · 181 partly · 1,232 not done** (out of 1,898; updated 2026-10-10).

- **Platform fixes and security** (earlier branches):
  - Auth bypass removed. `/execute/java` was open and leaked env; it is now locked down.
  - RLS lockdown of the live database, Campus tenancy, SQL isolation suites in CI.
- **Campus:**
  - Tenancy, departments, batches, rosters (Excel), branding.
  - Tests: MCQ, MSQ, NAT, coding, true/false, fill-in-the-blank and written; question pools; timed sections; extra time; Excel import.
  - Proctored exam in the web app; live invigilation.
  - Marking and feedback; paper versions; sharing tests between colleges.
  - Item analysis, insights, students at risk, student reports, CSV exports.
  - College structure (units, sections, academic records, eligibility).
  - Custom roles, activity log, consent and device check, bulk actions.
  - Notifications (in-app, email, reminders), placement drives, assigning Forge courses to colleges.
- **Forge:**
  - In-app practice with a server judge (JS, Python, Java, C++), hidden tests, submission history, editor quality.
  - The W2 slices above.
- **Docs:** platform audit, feature checklist, build plan, handoff.

Details of each slice: `docs/campus/BUILD_PLAN.md` (the "Slice … built" sections) and HANDOFF §0 and §5.

## 4. Left, and owner-only actions

**Engineering:**
- Rest of W2.
- W3–W7.
- Campus partials still open:
  - colleges authoring their own courses
  - project / GitHub assignments
  - webcam proctoring
  - notification templates
  - WhatsApp
  - rubric scoring per criterion

Full list: the 🟡 and ❌ rows in FEATURE_CHECKLIST.md.

**Done 2026-10-10 (owner asked):** all stacked branches and the August audit branch merged into `main`; every pending
migration applied to live and verified (schema fingerprint identical to the tested database; security advisor clean
except intended findings). Details: HANDOFF §0 and §4.

**Owner (production):**
1. ~~**Apply migrations on live, in order:**~~ done
   - First the older missing ones: `20260823000001` … `20260906000002`. Live lacks the xp ledger, resumes,
     bookmarks, chapter notes, mock tests and others.
   - Then the 21 pending ones: `20261010000001` … `20261029000002`.
   - After each, run the verify query in HANDOFF §8.1.
2. ~~**Merge the stacked branches into `main`, in order** (HANDOFF §3):~~ done
   1. `chore/launch-fixes-and-test-series`
   2. `feat/campus-phase-0`
   3. `feat/campus-phase-1`
   4. `ccr-f94ce2b7-q10f2w`

   Don't deploy the Forge API from `main` before this.
3. **Deploy Judge0** (`infra/judge0/README.md`), then set `JUDGE0_URL` and `JUDGE0_AUTH_TOKEN` on both APIs.
4. **Set environment variables:**
   - Forge API: `SELLER_LEGAL_NAME`, `SELLER_GSTIN`, `SELLER_ADDRESS` (invoices).
   - Campus API: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, plus `CRON_SECRET` or `SCHEDULER_MINUTES`.
   - Optional: a Monday cron calling `POST /api/cron/week-xp-snapshot`.
5. **Security:**
   - Rotate the shared admin password and the GitHub token encryption key.
   - Enable leaked-password protection in Supabase Auth.
6. **Remove made-up stats** ("10,000+ students") before demos.

## 5. How to work and verify (the rules)

- Read `CLAUDE.md` (repo root). Work on a feature branch off `main`. Make small, verified commits. Don't open PRs unless asked.
- **Database changes:**
  - New migration in `apps/api/supabase/migrations/` (additive, RLS on, server-only writes revoked from `authenticated`).
  - SQL suite in `apps/api/supabase/tests/*.sql`.
  - Mutation-test every policy and check.
  - Test on a disposable Postgres: `pnpm --filter @repo/api test:db` with `TEST_DATABASE_URL` set. Never a Supabase URL.
- **Campus API:** user requests go through `asUser` (RLS decides). Use `asSystem` only after access is proven.
- **Forge API code that reads tables that may be missing on live** must degrade gracefully (Postgres error `42P01`).
- **Checks before every push:**
  - SQL suites (15)
  - `cd apps/api && npx jest` (174)
  - Campus API tests (80)
  - `packages/assessment-core` tests (88)
  - Web typecheck with the project TypeScript: `apps/web/node_modules/.bin/tsc --noEmit -p tsconfig.app.json`. Ignore
    the known TS2786/TS2322 noise. Never use `npx tsc`: it picks TS 6 and checks nothing.
  - `npx vite build`
  - A Playwright browser run, including a 390px no-horizontal-scroll check.
- **Never put secrets in the repo.** Commit trailer lines are in the session instructions.

## 6. Where everything is documented

| Doc | What it holds |
|---|---|
| `CLAUDE.md` | Key rules, branch, DB testing rule |
| `docs/campus/HANDOFF.md` | **Detailed state**: status table (§0), repo map (§2), branches and merge order (§3), live DB (§4), chronology (§5), architecture rules (§6), run and test locally (§7), what's left, pending migrations and verify queries (§8), owner's working style (§9) |
| `docs/campus/FEATURE_CHECKLIST.md` | Status of every feature (✅ / 🟡 / ❌) with evidence; summary totals per module |
| `docs/campus/BUILD_PLAN.md` | Build order and a "Slice … built" section for every finished slice (DB / API / Web / Verified / Left out) |
| `docs/campus/PLATFORM_AUDIT.md` | The original audit of the platform and the live database |
| `docs/campus/LOCAL_E2E.md` | How to run the full stack locally (Postgres + PostgREST + API + web) for browser checks without touching Supabase |
| `infra/judge0/README.md` | Self-hosting Judge0 |
| `apps/*/.env.example` | Every environment variable each app needs |
| `docs/PROJECT_AUDIT.md`, `docs/architecture/`, `docs/runbooks/`, `docs/observability.md`, `docs/release-rollback-plan.md` | Older general docs (architecture, operations) |
