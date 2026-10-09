# Forge / Forge Campus — session handoff

**Last updated: 2026-10-12.** Resume on branch **`ccr-f94ce2b7-q10f2w`** — it contains everything
(launch fixes → Campus phase 0 → phase 1 → student Campus UI → in-app practice + server judge → coding questions
in Campus tests → C++ on the judge).
Working tree was clean and pushed at the end of the last session.

**Read next, in this order:**
1. This file — state, rules, what's left.
2. `docs/campus/BUILD_PLAN.md` — the agreed build order (tracks A–F, slices). Slices A1, B1 and A2 (C++) are done; **next is A4 content drafts** (§8.3).
3. `docs/campus/FEATURE_CHECKLIST.md` — all 1,898 features ticked with evidence (426 done, 226 partly, 1,246 not done).
4. `docs/campus/PLATFORM_AUDIT.md` — strategy: the assess → gaps → practise → readiness loop, risks.

Plan doc (Claude Docs, architecture + roadmap): https://claude.ai/artifact/QC8UE9d7H79QHW97V5GM15

---

## 0. Status at a glance (2026-10-12)

| Area | State |
|---|---|
| Campus staff portal + Campus API (phase 1, slices A–D) | ✅ built, tested; **not deployed** |
| Student side of Campus in `apps/web` (slice E): My College, proctored exam, results | ✅ built, browser-verified |
| In-app coding practice `/problems/:slug` + server judge (BUILD_PLAN slice A1) | ✅ built, browser-verified |
| Coding questions in Campus tests (slice B1): shared `packages/judge`, portal form, exam editor, partial marks, regrade | ✅ built, browser-verified |
| C++ on the judge (slice A2): practice (server Run + Submit) and Campus coding questions; forged-result fix | ✅ built, browser-verified |
| Judge: hidden expected outputs never reach learner programs (Java leak fixed) | ✅ |
| Timed, locked sections in Campus tests (slice B3) | ✅ built, browser-verified |
| Live invigilation board, timeline, reviews, extra time, end attempt (slice B5) | ✅ built, browser-verified |
| Practice submission history + editor settings/shortcuts/full screen (slice A3); `submissions` insert hole closed | ✅ built, browser-verified |
| Question pools (N of M) and per-student extra time (slice B2) | ✅ built, browser-verified |
| College question import from Excel/CSV; Excel roster upload (slice B4) | ✅ built, browser-verified |
| College structure (slice C1): unit tree, sections, academic records, eligibility rules, college defaults | ✅ built, browser-verified |
| Question types, marking, paper versions, test sharing (slice C2a) | ✅ built, browser-verified |
| Analytics (slice C2b): per-test item analysis, Insights (trends, roll-ups, at-risk students), student report, placement CSV | ✅ built, browser-verified |
| Activity log, custom roles, consent record, device check, onboarding checklist, bulk member actions (slice C2c) | ✅ built, browser-verified |
| Courses for colleges (slice D6): Learn ↔ Campus connected — assign courses/chapters, chapter progress, college licences, catalogue honours visibility | ✅ built, browser-verified |
| Live DB migrations `20261010000001_problem_judging`, `20261011000001_campus_coding_questions`, `20261012000001_problem_cpp_starters`, `20261013000001_campus_section_timing`, `20261014000001_campus_invigilation`, `20261015000001_practice_submission_history`, `20261016000001_campus_pools_accommodations`, `20261017000001_campus_courses`, `20261018000001_campus_structure`, `20261019000001_campus_question_types`, `20261020000001_campus_audit_roles` | ⏳ **not applied** — owner runs them (in that order) in the Supabase SQL editor; verify after (§8.1) |
| Judge0 | ⏳ owner will **self-host on a VM** (`infra/judge0/README.md`); then set `JUDGE0_URL` / `JUDGE0_AUTH_TOKEN` on the Forge API **and the Campus API** |
| Branches merged to `main` | ❌ not yet — see §3 |
| Next slice | **A4 · content drafts** (original DSA problems with tests + aptitude bank, for the owner's team to review); then D1–D5 college operations (§8.3) |

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
4. **`ccr-f94ce2b7-q10f2w`** — student Campus UI, platform audit + checklist + build plan, in-app practice + judge, shared judge package + coding questions in Campus tests (**work here**)

**Merge into `main` in that order before running/deploying the Forge API from `main`.** The live database
is already locked down (§4); `main`'s API still uses the public anon key server-side and will fail on the
locked tables. No PR has been opened yet (owner hasn't asked).

Separate, unmerged and **diverged**: `claude/project-audit-production-xn70jx` (10 commits from a72ae35:
money-path/security fixes, per-course purchasing, pricing redesign, resume fixes). It overlaps `main`'s later
work — cherry-pick its security/money-path commits (5853694, 703a30e) rather than merging it whole. Owner to decide.

## 4. Live database (Supabase project `learningheaven`, ref `wxrxnqhjkwlxvmaopvlv`, ap-south-1)

Applied via the Supabase MCP (in order), all verified after applying (`20261010000001_problem_judging`, `20261011000001_campus_coding_questions` and `20261012000001_problem_cpp_starters` are **pending**, §8.1):

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

### 2026-10-11 — Slice B1: coding questions in Campus tests (commits b195a9b, 0bceef3, 8d40365)
- `packages/judge` (`@repo/judge`): harnesses + Judge0 client + dev-only local runner with an explicit `JudgeConfig`;
  `apps/api/.../problemJudge.service.ts` is now a thin wrapper; `apps/campus-api/src/services/judge.ts` builds the
  Campus config (new env `JUDGE0_*`, see `.env.example`).
- Migration `20261011000001_campus_coding_questions.sql`: `question_type 'coding'`, `starter_code`, `judge_config`,
  `public.question_test_cases` (RLS via `campus.can_author_question()`; students/anon: nothing). 12 new SQL checks.
- `assessment-core` scoring: coding = marks × passed/total, no negatives, 0 while pending.
- Campus API: coding authoring (`routes/tests.ts`), attempt view sends starter code + samples only, code saves,
  `POST /my/attempts/:id/questions/:qid/run` (samples, 3 s cooldown), `finalize()` closes first then judges
  (`gradeCodingAnswers`), `POST /orgs/:org/assignments/:id/regrade` (needs `assessments.grade` + `reports.view`),
  results flag `gradingPending`.
- Web: `features/campus/CodingQuestion.tsx` in `CampusExamPage`; lockdown listeners now capture-phase (blocks paste
  in Monaco; drop counts as paste); result page shows tests passed. Portal: coding form, summary, Grade now banner.

### 2026-10-12 — Slice A2: C++ on the judge (commits 3bd1e09, 02fc073)
- `packages/judge/src/cpp.ts`: signature-driven C++ harness (typed literals from `name = value` inputs, JSON-style
  output). Judge0 id 54 + `-O2 -std=gnu++17`; local `g++`. New env `JUDGE0_CPP_LANGUAGE_ID` on both APIs.
- **Security:** duplicate result lines for a test now fail it (a learner could read the marker and forge "passed").
- Forge API `POST /api/problems/:id/run` (samples only, records nothing); practice sends C++ Run there. Migration
  `20261012000001_problem_cpp_starters.sql` (C++ starters for the 8 live problems). Campus coding questions allow C++.

## 6. Architecture rules for Campus (keep these)

- Campus API: `asUser(userId, fn)` runs as Postgres role `authenticated` with JWT claims → **RLS decides**. Use for every user-requested read/write.
- `asSystem(fn)` bypasses RLS — only **after** `asUser` has proven access, and only by explicit ids (questions with answers, attempt writes, user names).
- Students never receive correct answers while an attempt is open; scoring uses server-saved answers only; deadline = `least(start + duration, closes_at)`.
- JWT verified locally with `jose` (ES256 via the project JWKS; HS256 secret only for tests).
- Every new campus table: `org_id`, RLS on, composite FKs so rows can't mix colleges, and checks added to the SQL suites. Mutation-test new policies (break the rule, confirm a test fails).
- Code judging goes through `@repo/judge` only. Hidden tests never leave the server; students get samples only.
  Grading coding answers happens after the attempt is closed, so answers can't change mid-judging.

## 7. Run and test locally

```bash
pnpm install                         # builds packages/assessment-core via prepare
pnpm --filter @repo/assessment-core test   # 68 tests
pnpm --filter @repo/judge test             # 24 tests (runs real node/python3/java/g++)
pnpm --filter @repo/api test               # 92 jest tests
# Disposable Postgres 17 for DB tests (never a Supabase URL — the script refuses):
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm --filter @repo/api test:db       # 6 SQL suites
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm --filter @repo/campus-api test    # 74 integration tests
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
  kill commands in a script file and run it on its own. A Campus API left running keeps port 5100 and the new one
  dies with EADDRINUSE (check `ps -eo pid,lstart,args | grep src/server.ts`) — the old code then answers your test.

Env needed (not in repo; see each app's `.env.example`): `apps/api/.env` (Supabase URL/keys, DATABASE_URL,
REDIS_URL, Razorpay, JUDGE0_URL/JUDGE0_AUTH_TOKEN), `apps/campus-api/.env` (DATABASE_URL, SUPABASE_URL,
CORS_ORIGINS, optional JUDGE0_URL/JUDGE0_AUTH_TOKEN), `apps/campus/.env` (VITE_FORGE_API_URL, VITE_CAMPUS_API_URL, VITE_STUDENT_APP_URL),
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

Then for `20261011000001_campus_coding_questions` (apply **after** the one above):
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.testseries_questions'::regclass
   and conname in ('testseries_questions_question_type_check', 'chk_mcq_msq_options', 'testseries_questions_coding_check');
select relrowsecurity from pg_class where oid = 'public.question_test_cases'::regclass;          -- true
select policyname from pg_policies where tablename = 'question_test_cases';                      -- 1 staff policy
select has_table_privilege('anon', 'public.question_test_cases', 'select');                      -- false
```
Existing question rows are untouched (the migration only widens checks and adds columns with defaults).

Then `20261012000001_problem_cpp_starters`: `select count(*) from public.problems where starter_code ? 'cpp';` → 8.

Then `20261013000001_campus_section_timing`: `test_attempts` has `current_section`, `section_started_at`;
`select tgname from pg_trigger where tgname = 'test_questions_section_matches';` → 1 row.

Then `20261014000001_campus_invigilation`: tables `campus.attempt_adjustments`, `campus.incident_reviews` exist with
RLS on; `test_attempts.last_seen_at` exists; run the security advisor.

Then `20261015000001_practice_submission_history`: `public.problem_submissions` exists with RLS on and one select
policy; `select count(*) from pg_policies where tablename = 'submissions' and cmd = 'INSERT';` → 0.

Then `20261016000001_campus_pools_accommodations`: `test_sections.draw_count`, `tests.draw_count`, table
`campus.assignment_accommodations` with RLS on and 2 policies.

Then `20261017000001_campus_courses`: tables `campus.course_licences` (2 policies) and `campus.course_assignments`
(3 policies) with RLS on; functions `campus.course_licensed`, `campus.user_has_course_licence`,
`campus.user_can_see_course` exist, and the last two are **not** executable by `authenticated`:
`select has_function_privilege('authenticated', 'campus.user_can_see_course(uuid,uuid)', 'execute');` → false.
Then `select count(*) from public.courses where is_published and deleted_at is null and visibility = 'public';` → the
same number the catalogue showed before (6). Deploy the Forge API with this branch only **after** this migration:
without it `CourseAccessService` falls back to the old rule (own plan only) and logs nothing.

Then `20261018000001_campus_structure`: table `campus.sections` (RLS on, 2 policies); columns `departments.kind/parent_id`,
`org_memberships.cgpa/active_backlogs/tenth_percent/twelfth_percent`, `assignments.section_id/eligibility`;
`select count(*) from pg_policies where policyname = 'assignment_student_select';` → 1 and its `qual` uses
`is_assignment_target`. Existing students still see their tests: `select count(*) from campus.assignments a where not exists
(select 1 from campus.batch_members bm where bm.batch_id = a.batch_id);` is unaffected (rules default to `{}`).

Then `20261019000001_campus_question_types`: `testseries_questions` columns `text_answers, rubric, max_words, tags` and the
type check includes `tf, fib, descriptive`; `campus.assignments.paper_versions`; table `campus.test_shares` (RLS on, 2 policies);
`test_attempts.feedback`; `pg_get_functiondef('campus.test_usable_by_org(uuid,uuid)'::regprocedure)` mentions `test_shares`.

Then `20261020000001_campus_audit_roles`: tables `campus.custom_roles` and `campus.audit_log` (RLS on); columns
`org_memberships.custom_role_id`, `test_attempts.consent`; `select count(*) from pg_trigger where tgname = 'audit_row';` → 16;
`select campus.user_permissions(org_id, user_id) from campus.org_memberships limit 5;` returns the built-in role's permissions.
(Checked on live first: `auth.uid()` treats an empty setting as no user, which the trigger relies on.)

### 8.2 B1 — done (2026-10-11)
See `BUILD_PLAN.md` → "Slice B1 — built" for what exists, how it was verified and what was left out (editing a
coding question after creation, C/C++, per-test weights, plagiarism, showing code on the result page).

### 8.3 Then (BUILD_PLAN order)
- A2 is done for C++ (see BUILD_PLAN). C is left: LeetCode-style C passes arrays as pointer + size — needs its own
  harness (Judge0 id 50).
- A4 content: Claude drafts ~75 original DSA problems with tests + aptitude question bank → owner's team reviews →
  import. (Don't copy LeetCode statements verbatim; write originals.)
- B2–B5, C1–C4, D1–D5 per `BUILD_PLAN.md`.

### 8.4 Deploy (owner)
- Judge0 on its own VM (cgroup v1, privileged Docker) per `infra/judge0/README.md`; set `JUDGE0_URL`/`JUDGE0_AUTH_TOKEN`
  on the Forge API **and the Campus API** (coding questions; without it production marks them "grading pending").
- Campus API + portal (e.g. Railway); add portal and web origins to Campus API `CORS_ORIGINS`; set
  `VITE_CAMPUS_API_URL` on the web app.

### 8.5 Owner actions pending
- Run the eleven pending migrations in order (`20261010000001` … `20261020000001`) (§8.1), then tell Claude to verify
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
- Monaco loads from unpkg at runtime; consider bundling it (a college exam on a blocked network would lose the editor)
- `apps/web` and `apps/campus` `tsc -b` print a `baseUrl` deprecation (TS5101) when a global TypeScript 6 is picked up; use
  the local `node_modules/.bin/tsc` (5.9) — the build itself passes
- Campus coding questions can't be edited after creation (delete + re-add)
- Courses ↔ Campus (D6, 2026-10-12): the catalogue lists only published, public courses; a course page 404s unless
  `campus.user_can_see_course` allows it (org/batch/private courses); unpublished drafts no longer leak. One
  premium rule for chapters and problems (`CourseAccessService.hasPremiumAccess`: paid plan, plan grant, or college
  licence). Left: colleges can't **author** their own Learn courses in the portal yet (they can assign Forge's and
  any `owner_org_id = college` course created by Forge admin); removing a licence doesn't withdraw a course already
  assigned (students keep seeing it, the paywall applies again); no reminder emails for due courses (needs D2).
- Judge integrity rule (keep it): **expected outputs never enter the learner's program** — not on stdin, not in the
  generated source (the program can read its own source file). Answers are compared in TypeScript. With that rule,
  anything learner code prints in place of the judge's line it could equally have returned, so in-process output
  tampering gains nothing. Fixed 2026-10-12: the Java judge used to send expected outputs on stdin and in the source
  (a test proved a no-logic solution passed every hidden test).
- Practice page `Star`/bookmark and company filter not built; solution text exists for 0 problems

## 9. Working style the owner prefers
Proceed autonomously on agreed plans, commit in small verified slices, push to the feature branch, verify
live changes after applying them, report concisely. Ask before destructive or production-affecting steps
the owner hasn't approved.
