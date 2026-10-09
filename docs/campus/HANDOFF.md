# Forge / Forge Campus — session handoff

Last updated: 2026-10-09. Work branch: **`feat/campus-phase-1`** (contains everything below).
Plan doc (shared, with architecture + roadmap diagrams): https://claude.ai/artifact/QC8UE9d7H79QHW97V5GM15

---

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

Stacked branches, all pushed to origin:

1. `chore/launch-fixes-and-test-series` — test-series feature + first audit fixes
2. `feat/campus-phase-0` — Judge0, API client/auth fixes, RLS lockdown, Campus tenancy
3. `feat/campus-phase-1` — Phase 1 (assessment-core, Campus API, Campus portal)

**Merge into `main` in that order before running/deploying the Forge API from `main`.** The live database
is already locked down (§4); `main`'s API still uses the public anon key server-side and will fail on the
locked tables.

## 4. Live database (Supabase project `learningheaven`, ref `wxrxnqhjkwlxvmaopvlv`, ap-south-1)

Applied via the Supabase MCP (in order), all verified after applying:

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

## 6. Architecture rules for Campus (keep these)

- Campus API: `asUser(userId, fn)` runs as Postgres role `authenticated` with JWT claims → **RLS decides**. Use for every user-requested read/write.
- `asSystem(fn)` bypasses RLS — only **after** `asUser` has proven access, and only by explicit ids (questions with answers, attempt writes, user names).
- Students never receive correct answers while an attempt is open; scoring uses server-saved answers only; deadline = `least(start + duration, closes_at)`.
- JWT verified locally with `jose` (ES256 via the project JWKS; HS256 secret only for tests).
- Every new campus table: `org_id`, RLS on, composite FKs so rows can't mix colleges, and checks added to the SQL suites. Mutation-test new policies (break the rule, confirm a test fails).

## 7. Run and test locally

```bash
pnpm install                         # builds packages/assessment-core via prepare
# Disposable Postgres 17 for tests (never a Supabase URL — the script refuses):
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm --filter @repo/api test:db       # SQL suites
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm --filter @repo/campus-api test    # 22 integration tests
pnpm --filter @repo/assessment-core test
pnpm --filter @repo/api test          # 68 jest tests (Forge API)
```

Env needed (not in repo; see each app's `.env.example`): `apps/api/.env` (Supabase URL/keys, DATABASE_URL,
REDIS_URL, Razorpay, optional JUDGE0_URL/JUDGE0_AUTH_TOKEN), `apps/campus-api/.env` (DATABASE_URL,
SUPABASE_URL, CORS_ORIGINS), `apps/campus/.env` (VITE_FORGE_API_URL, VITE_CAMPUS_API_URL,
VITE_STUDENT_APP_URL; dev uses the Vite proxy). Redis must be running for the Forge API.

## 8. Next — what still needs doing

### 8.1 Slice E (finishes Phase 1): student side in `apps/web`
Students can't take Campus tests in the browser yet; the API already supports it.
- "My college" page: `GET /campus/v1/my/assignments` (state upcoming/open/closed, attempts used, results when released). Call `GET /campus/v1/me` once after sign-in (claims roster entries).
- Exam screen (full-screen route, no app chrome, like `/test-series/tests/:id`), reusing the CBT UI ideas from `apps/web/src/pages/testseries/CBTTestPage.tsx`:
  - `POST /my/assignments/:id/start` → questions (no answers), `expiresAt`, `serverNow`, `proctoring` policy, `violationCount`
  - autosave `PUT /my/attempts/:id/answers/:questionId` `{selectedOptions | natValue, markedForReview}`
  - timer from `expiresAt` corrected by `serverNow`; `POST /my/attempts/:id/submit`
  - lockdown when `proctoring.enabled`: request fullscreen; report `tab_switch` (visibilitychange), `window_blur`, `fullscreen_exit`, `copy`/`paste`/`context_menu` (also block them) via `POST /my/attempts/:id/events`; show the warning and a violation counter pill; if `autoSubmitted` → result screen
  - result view when `result.released`
- Web needs `VITE_CAMPUS_API_URL` and a Vite proxy for `/campus` → 5100. Then an end-to-end run.

### 8.2 Deploy
- Campus API + portal (e.g. Railway) with env above; add portal origin to Campus API `CORS_ORIGINS`.
- Judge0 on its own VM (cgroup v1, privileged Docker) per `infra/judge0/README.md`; set `JUDGE0_URL`/`JUDGE0_AUTH_TOKEN` on the Forge API.

### 8.3 Phase 2 (per plan doc)
College-authored courses & build challenges, licensing Forge content to colleges (`content_shares`),
subjective grading queue, coding questions in tests (Judge0 + hidden test cases), webcam proctoring
(MediaPipe) + live invigilator board (Supabase Realtime), live classes (Meet/Zoom links + attendance),
placement-officer dashboard and student records. Phase 3: LTI 1.3 (ltijs), Google sign-in by college
domain, custom domains, placement drives, accreditation reports, plagiarism, load test at 2× peak.

### 8.4 Open decisions (owner's call)
Pilot college and its exam date; pricing (per student per year vs month — ask 2–3 placement officers);
webcam proctoring in the first pilot or not.

### 8.5 Owner actions pending
- Merge branches (§3)
- Rotate: the admin password that was shared in chat; GitHub token encryption key (tables were readable until 2026-10-08)
- Turn on leaked-password protection in Supabase Auth settings

### 8.6 Known issues backlog (from the audit)
- Landing page / `getPublicStats` show fabricated numbers ("10,847 students", +10,000 offset) — legal risk; owner to decide
- Test data visible to buyers: 22 duplicate "Fullstack Apprenticeship" programs, duplicate HTML course, empty "Learn English A to Z"
- `/course-preview` is an orphan page with a dead course slug — delete
- 9 stale web specs (BuildChallengePage, BuildWorkspacePage) fail after redesigns
- ~870 web TS errors from React 19 types leaking into React 18 web app (BH-005); build still passes
- Resume page horizontal scroll on mobile; placeholder "Johan Smith" resume

## 9. Working style the owner prefers
Proceed autonomously on agreed plans, commit in small verified slices, push to the feature branch, verify
live changes after applying them, report concisely. Ask before destructive or production-affecting steps
the owner hasn't approved.
