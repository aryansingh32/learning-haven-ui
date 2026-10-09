# Forge / Forge Campus — session handoff

**Last updated: 2026-10-10.** Resume on branch **`ccr-f94ce2b7-q10f2w`** — it contains everything
(launch fixes → Campus phase 0 → phase 1 → student Campus UI → in-app practice + server judge).
Working tree was clean and pushed at the end of the last session.

**Read next, in this order:**
1. This file — state, rules, what's left.
2. `docs/campus/BUILD_PLAN.md` — the agreed build order (tracks A–F, slices). Slice A1 is done; **next is B1**.
3. `docs/campus/FEATURE_CHECKLIST.md` — all 1,898 features ticked with evidence (351 done, 266 partly, 1,281 not done).
4. `docs/campus/PLATFORM_AUDIT.md` — strategy: the assess → gaps → practise → readiness loop, risks.

Plan doc (Claude Docs, architecture + roadmap): https://claude.ai/artifact/QC8UE9d7H79QHW97V5GM15

---

## 0. Status at a glance (2026-10-10)

| Area | State |
|---|---|
| Campus staff portal + Campus API (phase 1, slices A–D) | ✅ built, tested; **not deployed** |
| Student side of Campus in `apps/web` (slice E): My College, proctored exam, results | ✅ built, browser-verified |
| In-app coding practice `/problems/:slug` + server judge (BUILD_PLAN slice A1) | ✅ built, browser-verified |
| Live DB migration `20261010000001_problem_judging.sql` | ⏳ **not applied** — owner is running it in the Supabase SQL editor; verify after (§8.1) |
| Judge0 | ⏳ owner will **self-host on a VM** (`infra/judge0/README.md`); then set `JUDGE0_URL` / `JUDGE0_AUTH_TOKEN` on the Forge API |
| Branches merged to `main` | ❌ not yet — see §3 |
| Next slice | **B1 · coding questions in Campus tests** (owner chose this) — design in §8.2 |

### Owner decisions recorded (2026-10-10)
- Apply the problem-judging migration: **yes** (owner runs it themselves; Claude verifies).
- Judge0: **self-host on our own VM**.
- Next build: **coding questions in college tests (B1)**.
- Content (DSA problems, aptitude questions): **Claude drafts originals, owner's team reviews** before publishing.

## 1. What this product is

**Forge** (repo `learning-haven-ui`) — an Indian coding-education platform (DSA courses, build challenges
verified via GitHub + Docker, apprenticeships, mock tests, test series, AI mentor). B2C, pre-launch:
~12 users, 0 completed payments as of 2026-10-07.

**Forge Campus** — the B2B add-on being built now: a college LMS / assessment platform in the style of
iamneo (neoExam/NeoPAT). Colleges get their own staff portal, batches, rosters, their own tests and build
challenges, proctored assignments, results and reports. Strategy: sell to the college Training &
Placement Officer as a "placement-readiness" product, not as a generic LMS.

Decision taken: **build on our own code + open-source components**, do not fork an LMS (all mature
open-source LMSs are GPL/AGPL; AGPL forks would force publishing our source). Components: Judge0
(GPLv3, unmodified, separate server) for code execution; ltijs (Apache-2.0, LTI 1.3) later; MediaPipe
(Apache-2.0) for webcam proctoring later. ClassroomIO and Frappe LMS were studied for UX/feature ideas
only — **no code copied** (AGPL).

## 2. Repo map

| Path | What |
|---|---|
| `apps/web` | Learner app (React 18, Vite 5) — port 5173 |
| `apps/admin` | Forge staff admin (React 19, Vite 7) — port 5174 |
| `apps/api` | Forge API (Express, Supabase, pg, Redis/BullMQ) — port 5000 |
| `apps/campus-api` | **New** Campus API (Express, pg, jose) — port 5100, prefix `/campus/v1` |
| `apps/campus` | **New** Campus staff portal (React 19, Vite 7, Tailwind 4, shadcn) — port 5175 |
| `packages/assessment-core` | **New** pure shared logic: scoring, seeded shuffle, roster CSV parsing, proctoring rules |
| `apps/api/supabase/migrations` | SQL migrations (the live DB has drifted from older ones — see §4) |
| `apps/api/supabase/tests` | SQL security suites + fixtures (live-schema snapshot, Supabase stubs) |
| `infra/judge0/README.md` | How to self-host Judge0 |
| `.github/workflows/db-tests.yml` | CI: SQL suites + assessment-core + Campus API integration tests |

## 3. Branches and merge order (IMPORTANT)

Stacked branches, all pushed to origin, each containing the one before:

1. `chore/launch-fixes-and-test-series` — test-series feature + first audit fixes
2. `feat/campus-phase-0` — Judge0, API client/auth fixes, RLS lockdown, Campus tenancy
3. `feat/campus-phase-1` — Phase 1 (assessment-core, Campus API, Campus portal)
4. **`ccr-f94ce2b7-q10f2w`** — student Campus UI, platform audit + checklist + build plan, in-app practice + judge (**work here**)

**Merge into `main` in that order before running/deploying the Forge API from `main`.** The live database
is already locked down (§4); `main`'s API still uses the public anon key server-side and will fail on the
locked tables. No PR has been opened yet (owner hasn't asked).

Separate, unmerged and **diverged**: `claude/project-audit-production-xn70jx` (10 commits from a72ae35:
money-path/security fixes, per-course purchasing, pricing redesign, resume fixes). It overlaps `main`'s later
work — cherry-pick its security/money-path commits (5853694, 703a30e) rather than merging it whole. Owner to decide.

## 4. Live database (Supabase project `learningheaven`, ref `wxrxnqhjkwlxvmaopvlv`, ap-south-1)

Applied via the Supabase MCP (in order), all verified after applying (`20261010000001_problem_judging` is **pending**, §8.1):

| Migration | Effect |
|---|---|
| `20261008000001_lock_down_open_tables` | RLS on 37 tables the anon key could fully read/write (OTPs, coupons, certificates, admin roles, settings, courses…). 0 public tables without RLS now. |
| `20261008000002_campus_tenancy` | `campus` schema: organizations (Forge = platform org `00000000-0000-0000-0000-00000000f0f0`), org_memberships, departments, batches, batch_members/faculty, role_permissions; RLS via security-definer helpers |
| `20261008000003_content_ownership` | `owner_org_id` + `visibility` on courses, test_series, tests, programs, exam_categories, categories, testseries_questions (existing rows = Forge, public; questions private) |
| `20261009000001_campus_assessments` | roster_entries + `claim_roster_entries()`, college-authored tests, assignments (+ trigger refusing unusable tests), attempt extensions, proctoring_events. Also fixed: learners could write their own `test_attempts` (incl. score) → now read-only; public catalogue shows only `visibility='public'` tests |

Security advisor after: no ERROR findings. Remaining: "RLS enabled, no policy" (intended, server-only
tables), 3 old functions with mutable search_path, leaked-password protection off (dashboard toggle).

Rules: don't add `campus` to PostgREST exposed schemas. Before any live migration: check for drift with
read-only queries, test locally (§7), then apply via MCP and verify.

## 5. What was done (chronological)

**Audit + launch fixes** (`chore/launch-fixes-and-test-series`)
- `/execute/java` was unauthenticated and passed the API's env (secrets) to user Java → auth + rate limit + stripped env
- `ProtectedRoute` auth bypass ("TEMPORARY … UI testing") removed
- `express-async-errors` loaded + `unhandledRejection` handler (one failing handler crashed the API)
- analytics wrote to non-existent columns (0 rows ever) → mapped to real schema
- certificate page retry/wording fixes; vitest config for `tests/frontend`

**Phase 0** (`feat/campus-phase-0`)
- Judge0 backend for Java (`modules/execution/services/judge0.service.ts`), local JDK runner dev-only, prod → 503 without `JUDGE0_URL`
- API server-side Supabase client moved from anon key → service-role key; sign-in/up/refresh use a per-request client (`createAuthClient`); sign-out revokes the caller's token; phone sign-up `admin.createUser` now works
- RLS lockdown + Campus tenancy + content ownership migrations; 36-check SQL isolation suite; CI

**Phase 1** (`feat/campus-phase-1`)
- A: `packages/assessment-core` (41 tests)
- B: `20261009000001_campus_assessments` + 43-check SQL suite (mutation-tested)
- C: `apps/campus-api` — `/me` (claims roster), admin (departments, batches, members, roster preview/import, branding), faculty (tests + MCQ/MSQ/NAT questions, assignments, results + CSV), student (`/my/assignments`, start/resume, autosave, proctoring events with warn-first/auto-submit, submit), `/platform/colleges` (Forge staff create a college + owner). 22 integration tests on real Postgres. Attempts are scored on the questions dealt at start (regression-tested).
- D: `apps/campus` portal — login (via Forge API), overview, assignments (+ create dialog with lockdown settings), results (every batch student, filters, CSV), tests + editor, batches/departments, people (members, roster upload with per-line errors, pending), settings (brand colour/logo), platform colleges page. Verified with screenshots against a seeded local DB: no console errors or failed requests.


**Student Campus UI** (`ccr-f94ce2b7-q10f2w`, slice E)
- `apps/web`: `/college` (My College), `/college/tests/:id` (instructions → full-screen proctored exam: server-corrected
  timer, instant autosave + retry, palette/bottom sheet, lockdown with de-duplicated leave events, warning/violation
  dialogs, auto-submit), `/college/attempts/:id` (result). Sidebar item + dashboard card for students only.
  Files: `src/pages/campus/*`, `src/features/campus/*`, `src/services/campus.service.ts`, `src/hooks/useCampus.ts`.
- Campus API fixes: `/my/assignments` includes the proctoring policy; result `perQuestion` follows the dealt (shuffled) order.

**Audit, checklist, plan** (docs only): `PLATFORM_AUDIT.md`, `FEATURE_CHECKLIST.md`, `BUILD_PLAN.md`.
Key findings: the learner code editor was only on a dev page; live DB has just 8 problems, 6 courses / 72 chapters,
0 test-series questions; "Learn English A to Z" is empty.

**Slice A1 — in-app practice + server judge** (`ccr-f94ce2b7-q10f2w`)
- `packages/assessment-core/src/judging.ts` — `compareOutputs(actual, expected, mode)`; modes `exact | unordered |
  unordered_deep`; parses JSON / Python repr / Java toString; float tolerance. Used by browser Run and server judge.
- Migration `20261010000001_problem_judging.sql` — `public.problem_test_cases` (sample + hidden, server-only RLS),
  `problems.starter_code`, `problems.judge_config` (+ check constraint); seeds tests + starter code for the 8 live
  problems by slug. SQL suite `tests/problem_judging.sql` (7 checks, mutation-tested).
- `apps/api/src/modules/execution/services/problemJudge.service.ts` — JS/Python harnesses + Java via existing harness;
  Judge0 when `JUDGE0_URL` set, local runner in development, production refuses without Judge0; hidden tests never
  revealed. New env: `JUDGE0_JS_LANGUAGE_ID` (63), `JUDGE0_PYTHON_LANGUAGE_ID` (71).
- `apps/api/src/modules/learning/controllers/judge.controller.ts` — `POST /problems/:id/judge` (solve + XP only on
  Accepted), `POST /problems/:id/status` (tried/revision; solved only for problems without tests).
  Old `POST /problems/:id/submit` now refuses problems that have tests. Premium checks read the plan from entitlements.
- `apps/web`: `src/pages/ProblemPage.tsx`, `src/features/practice/*`; workspace module got optional props
  (`questionPanel`, `languages`, `onSubmit`, `storageKey`, `compareMode`). Practice page opens problems in-app.
- Bugs fixed: Practice linked to a non-existent page; Practice status menu never worked; premium always "free";
  old submit trusted the browser; editor reset (and lost autosave) on refetch; ProgressRing NaN on 0/0.

## 6. Architecture rules for Campus (keep these)

- Campus API: `asUser(userId, fn)` runs as Postgres role `authenticated` with JWT claims → **RLS decides**. Use for every user-requested read/write.
- `asSystem(fn)` bypasses RLS — only **after** `asUser` has proven access, and only by explicit ids (questions with answers, attempt writes, user names).
- Students never receive correct answers while an attempt is open; scoring uses server-saved answers only; deadline = `least(start + duration, closes_at)`.
- JWT verified locally with `jose` (ES256 via the project JWKS; HS256 secret only for tests).
- Every new campus table: `org_id`, RLS on, composite FKs so rows can't mix colleges, and checks added to the SQL suites. Mutation-test new policies (break the rule, confirm a test fails).

## 7. Run and test locally

```bash
pnpm install                         # builds packages/assessment-core via prepare
pnpm --filter @repo/assessment-core test   # 46 tests
pnpm --filter @repo/api test               # 86 jest tests (incl. judge tests that run real node/python3/java)
# Disposable Postgres 17 for DB tests (never a Supabase URL — the script refuses):
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm --filter @repo/api test:db       # 3 SQL suites
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm --filter @repo/campus-api test    # 22 integration tests
cd apps/web && npx vitest run              # 17 pass; 9 known stale Build-page specs fail (pre-existing)
cd apps/web && npx vite build              # must pass
```

- **Only Postgres 16 available?** The schema snapshot sets `transaction_timeout` (PG17-only). Build the DB by hand:
  copy `tests/fixtures/public_schema_2026-10-08.sql` without the `SET transaction_timeout` line, load stubs + that copy
  + migrations ≥ 20261008, then run `npx jest --runInBand --globalSetup <a no-op file>` for the Campus API.
- **Web typecheck:** ~980 errors are pre-existing React 19 types leaking into the React 18 app (TS2786 and lucide
  `ForwardRefExoticComponent` TS2322). Compare against a baseline; only *new non-React-types* errors matter.
- **Browser checks:** Playwright is at `/opt/node-tools/node_modules/playwright` (Chromium preinstalled). In a cloud
  sandbox, unpkg is blocked — route `https://unpkg.com/monaco-editor@0.44.0/min/vs/**` to
  `node_modules/.pnpm/monaco-editor@*/node_modules/monaco-editor/min/vs`. Vite needs `--host 127.0.0.1` (no IPv6).
- **Sandbox gotcha:** `pkill -f <pattern>` kills your own shell if the command line contains the pattern — put
  kill commands in a script file and run it on its own.

Env needed (not in repo; see each app's `.env.example`): `apps/api/.env` (Supabase URL/keys, DATABASE_URL,
REDIS_URL, Razorpay, JUDGE0_URL/JUDGE0_AUTH_TOKEN), `apps/campus-api/.env` (DATABASE_URL, SUPABASE_URL,
CORS_ORIGINS), `apps/campus/.env` (VITE_FORGE_API_URL, VITE_CAMPUS_API_URL, VITE_STUDENT_APP_URL),
`apps/web/.env` (see `apps/web/.env.example`; `VITE_CAMPUS_API_URL` in production, Vite proxies `/campus/v1` in dev).
Redis must be running for the Forge API.

## 8. What's left — in order

### 8.1 Verify the live migration (as soon as the owner says it's applied)
Run read-only on project `wxrxnqhjkwlxvmaopvlv`:
```sql
select p.slug, p.judge_config->>'compare' compare, count(t.*) tests,
       count(*) filter (where t.is_sample) samples, p.starter_code ? 'java' has_starter
from public.problems p left join public.problem_test_cases t on t.problem_id = p.id
where p.deleted_at is null group by p.slug, p.judge_config, p.starter_code order by p.slug;
```
Expect 8 rows, 5–6 tests, 2 samples, `has_starter = true`. Also confirm RLS is on for `problem_test_cases` with no
policies, and run the security advisor.

### 8.2 Next slice — B1: coding questions in Campus tests (owner chose this)
Goal: faculty add a **coding** question (statement, starter code, sample + hidden tests, marks); students answer it
in the proctored exam with the same editor; scored on the server, partial marks per test passed.
Design sketch (reuse, don't fork):
- DB (new migration, additive): `testseries_questions.question_type` gains `coding`; new
  `campus`-owned or public `question_test_cases` (question_id, input, expected_output, is_sample, weight) with RLS
  like `problem_test_cases` (server-only); `question_type='coding'` rows carry `starter_code`, `judge_config`.
  Add checks to `apps/api/supabase/tests/campus_assessments.sql` (students can't read hidden tests; other colleges
  can't read them at all). Mutation-test.
- Judge: move the harness/runner from `apps/api/.../problemJudge.service.ts` into something both APIs can use
  (e.g. `packages/judge` or a Campus-API copy that imports `compareOutputs` from assessment-core) — Campus API
  needs `JUDGE0_URL` too; dev uses the local runner.
- `assessment-core` scoring: a coding answer stores `{ code, language, passed, total }`; marks = marks × passed/total
  (partial), no negative marking for coding.
- Campus API: faculty question create/edit accepts coding + tests (`routes/tests.ts`); student
  `PUT /my/attempts/:id/answers/:qid` accepts `{ code, language }`; new `POST /my/attempts/:id/run/:qid` (samples
  only, rate-limited); final judging of every coding answer happens in `finalize()` before scoring.
- Portal (`apps/campus/src/pages/TestEditor.tsx`): coding question form (statement, starter code per language,
  tests table, marks). Student exam (`apps/web/src/pages/campus/CampusExamPage.tsx`): render the `CodeWorkspace`
  editor for coding questions inside the existing exam layout (autosave via the existing answer endpoint; Run uses
  the new run endpoint; no Submit button — the attempt submit judges it). Lockdown must keep working (paste is
  blocked by policy — check Monaco paste is also caught).
- Results: per-question marks and tests passed; faculty results CSV gets the coding score.

### 8.3 Then (BUILD_PLAN order)
- A2: C/C++ on the judge; per-test partial score for practice too.
- A4 content: Claude drafts ~75 original DSA problems with tests + aptitude question bank → owner's team reviews →
  import. (Don't copy LeetCode statements verbatim; write originals.)
- B2–B5, C1–C4, D1–D5 per `BUILD_PLAN.md`.

### 8.4 Deploy (owner)
- Judge0 on its own VM (cgroup v1, privileged Docker) per `infra/judge0/README.md`; set `JUDGE0_URL`/`JUDGE0_AUTH_TOKEN`
  on the Forge API (and later the Campus API for B1).
- Campus API + portal (e.g. Railway); add portal and web origins to Campus API `CORS_ORIGINS`; set
  `VITE_CAMPUS_API_URL` on the web app.

### 8.5 Owner actions pending
- Run the problem-judging migration (§8.1), then tell Claude to verify
- Merge branches (§3); decide on the diverged audit branch
- Rotate: the admin password that was shared in chat; GitHub token encryption key (tables were readable until 2026-10-08)
- Turn on leaked-password protection in Supabase Auth settings
- Remove fabricated stats ("10,847 students", "Join 10,000+ students" on Practice) before any college demo

### 8.6 Open decisions (owner's call)
Pilot college and its exam date; pricing (per student per year vs month); webcam proctoring in the first pilot or not.

### 8.7 Known issues backlog
- Landing page / `getPublicStats` show fabricated numbers ("10,847 students", +10,000 offset) — legal risk; owner to decide
- Test data visible to buyers: 22 duplicate "Fullstack Apprenticeship" programs, duplicate HTML course, empty "Learn English A to Z"
- `/course-preview` is an orphan page with a dead course slug — delete
- 9 stale web specs (BuildChallengePage, BuildWorkspacePage) fail after redesigns
- ~870 web TS errors from React 19 types leaking into React 18 web app (BH-005); build still passes
- Resume page horizontal scroll on mobile; placeholder "Johan Smith" resume
- CI does not run the Forge API jest suite (only SQL suites, assessment-core, Campus API) — worth adding
- Monaco loads from unpkg at runtime; consider bundling it
- Practice page `Star`/bookmark and company filter not built; solution text exists for 0 problems

## 9. Working style the owner prefers
Proceed autonomously on agreed plans, commit in small verified slices, push to the feature branch, verify
live changes after applying them, report concisely. Ask before destructive or production-affecting steps
the owner hasn't approved.
