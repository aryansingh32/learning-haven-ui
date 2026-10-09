# Forge + Forge Campus — platform audit against the master feature inventory

Audited 2026-10-09 on branch `ccr-f94ce2b7-q10f2w` (= `feat/campus-phase-1` + the student Campus UI).
Covers `main`, every branch on origin, all apps (`web`, `admin`, `api`, `campus`, `campus-api`),
`packages/assessment-core` and the SQL migrations. Evidence is cited as file paths so each line can be checked.

**Legend** — ✅ built and usable · 🟡 partly there (gap named) · ❌ missing · ⏸ deliberately not now.
**When** — **P1** = needed for the first paying college pilot · **P2** = after the pilot starts · **P3** = after a
paying pilot (per the plan doc's phase gate) · **Later** = only with demand · **Skip** = not worth building.

---

## 1. Verdict in one page

Forge is **not** an LMS with a chatbot bolted on — it already owns the hard, differentiating half of the
inventory: a coding platform (Monaco, 4 in-browser runtimes, Judge0 for Java), GitHub-verified build projects
verified in Docker, apprenticeships, a CBT test engine with negative marking, an AI mentor, resume builder with
ATS scoring, jobs board, gamification, referrals and verifiable certificates. Forge Campus adds multi-college
tenancy with database-enforced isolation, rosters, college-authored tests, proctored assignments and results.

Against the 60 modules: **~12 are substantially built, ~25 are partly there, ~23 are missing.** That is the
right shape for a pilot: the missing ones are mostly breadth (labs, live classes, parent portal, accreditation,
multilingual), not the core loop.

The defensible product is the **closed loop** the inventory ends with — *assess → find gaps → plan → practise →
reassess → verify mastery → placement readiness*. Today every stage exists **in isolation**, but nothing joins
them: Campus test results don't feed the AI mentor, the knowledge map isn't fed by tests, and "placement
readiness" is computed in the browser (`apps/web/src/context/RoadmapContext.tsx`). **The single most valuable
next build is a shared skill graph that every activity writes evidence into** (§4). It turns separate features
into the product.

What is blocking a pilot is small and specific (§5): merge the stacked branches, deploy Campus + Judge0, coding
questions inside Campus tests, a placement-officer dashboard, and question bank import per college.

---

## 2. Repository and branch state

| Branch | State | Contents |
|---|---|---|
| `main` (8cad412, 2026-09-01) | Production line | Forge learner app, admin, API. No Campus. Its API still uses the public anon key server-side → **breaks against the live DB**, which was locked down on 2026-10-08. |
| `chore/launch-fixes-and-test-series` | Unmerged, base of the stack | Test-series CBT engine + question bank + admin builder; audit fixes (unauthenticated `/execute/java`, ProtectedRoute bypass, crash on unhandled rejection). |
| `feat/campus-phase-0` | Unmerged, on the above | Judge0 sandbox; API off the anon key; RLS on 37 open tables; Campus tenancy. |
| `feat/campus-phase-1` | Unmerged, on the above | `assessment-core`, Campus API, Campus staff portal. |
| `ccr-f94ce2b7-q10f2w` | **This work**, on the above | Student-side Campus UI in `apps/web` (§7) + two Campus API fixes. |
| `claude/project-audit-production-xn70jx` | **Unmerged, diverged** (forks at a72ae35, 10 commits, 85 files) | Money-path and security fixes, per-course purchasing, pricing redesign, resume fixes, dark-mode fixes, quiz one-at-a-time, Vibe-coding verification engine. **Overlaps `main`'s own 8c00d10** (both add per-course purchasing / CourseCheckoutModal) → expect conflicts. |
| `claude/proprietary-content-paid-tier-r7ti1l` | Merged into `main` (PR #1) | Notebook, mock tests, video interaction layer, visualizer. |

**Action:** merge in this order — launch-fixes → campus-phase-0 → campus-phase-1 → this branch. Then decide on
the audit branch: cherry-pick its security/money-path commits (5853694 and the purchase-path tests 703a30e)
rather than merging wholesale; its UI redesigns conflict with later work on `main`.

## 3. Architecture today, and the rules that keep Forge safe while Campus grows

```
 apps/web (learner, React 18) ──► apps/api (Forge, Express) ──► Supabase Postgres (public schema)
        │  "My College" (new)                                  ▲        RLS on every table
        └──────────────────────► apps/campus-api (Express) ────┘  campus schema, RLS via helpers
 apps/campus (staff portal) ─────► apps/campus-api           Judge0 (separate VM) ◄── apps/api
 apps/admin (Forge staff) ───────► apps/api                   Redis/BullMQ ◄── apps/api workers
```

How this audit's recommendations avoid compromising the existing product — every one follows these:

1. **Additive only.** New tables live in the `campus` schema; existing tables only gain columns with defaults
   (`owner_org_id` defaults to the Forge org, `visibility` defaults to `public`). Forge-only users see no change.
2. **Membership-gated UI.** Campus UI in `apps/web` renders only for users with a student membership (the nav
   item, the dashboard card). Verified: a Forge-only learner sees no link and is refused the test route.
3. **RLS decides.** Campus API runs user requests as `authenticated` with the user's JWT claims (`asUser`);
   system access only after access is proven, by explicit id. Every new table: `org_id`, RLS, composite FKs,
   checks in `apps/api/supabase/tests/*.sql`, mutation-tested.
4. **Fail closed, fail quiet.** If the Campus API is down, Forge keeps working — Campus calls fail silently and
   the college area hides (`apps/web/src/hooks/useCampus.ts`).
5. **One account.** Same Supabase identity across Forge and Campus; roster entries are claimed on sign-in.

---

## 4. The closed loop — what exists, what's missing, how to connect it

| Loop stage | What exists | Missing link |
|---|---|---|
| **Assess** | Campus assignments (MCQ/MSQ/NAT, proctored) · Test Series CBT · mock tests from course quizzes · DSA problems with submissions · build challenges | No coding questions in Campus tests; no aptitude content |
| **Identify gaps** | `getMentorContext` (`apps/api/src/modules/auth/services/gamification.service.ts`), knowledge-graph widget on the dashboard, per-question scoring in `assessment-core` | Questions carry `topic`/`difficulty` but **no result writes a per-skill score**. Campus results are invisible to Forge's gap detection |
| **Plan** | Daily missions & quests, roadmap context, AI mentor | Plan isn't generated from measured gaps |
| **Teach & practise** | Courses/chapters with video, visualizer, notebook; 4 code runtimes; problems; projects | — (strongest part) |
| **Reassess** | Retakes (`max_attempts`), mock tests | No adaptive re-test targeting the weak skills |
| **Verify mastery** | GitHub-verified projects, certificates with public verification page | No "skill verified" credential tied to evidence |
| **Placement readiness** | Client-side career readiness in `RoadmapContext.tsx` | Not server-side, not explainable, not visible to the college |

**Proposed connective tissue (one migration, additive):**

- `public.skills` (id, slug, name, parent_id, kind: topic | language | aptitude | soft) — seeded from existing
  question `topic` values and problem categories.
- `public.skill_evidence` (user_id, skill_id, source: campus_attempt | problem | chapter_quiz | project | mock_test,
  source_id, score 0–1, weight, occurred_at, org_id nullable) — **append-only**, written by each scorer
  (`finalize()` in `apps/campus-api/src/services/attempts.ts`, problem submissions, quiz grading, build verification).
- `public.skill_mastery` (materialised per user × skill: estimate, confidence, last_evidence_at) — recomputed by
  a BullMQ job with recency decay (gives forgetting-curve / spaced-repetition signals for free).
- Readiness score = weighted mastery over a **role or company profile** (`readiness_profiles`: skill weights per
  role/company). Explainable by construction: "you're 62% ready for TCS NQT; biggest gaps: arrays (0.4), DP (0.2)".

Every downstream feature in the inventory — weak-topic indicators, AI study plans, adaptive tests, faculty
at-risk alerts, placement-officer eligibility, skill passport — then reads one table instead of inventing its own.

---

## 5. Pilot-blocking list (P1) — in order

1. **Merge the stack** (§2) and redeploy the Forge API — `main` can't run against the live DB today.
2. **Deploy** Campus API + portal, and Judge0 on its own VM (`infra/judge0/README.md`); set `VITE_CAMPUS_API_URL`
   on the web app and add its origin to Campus API `CORS_ORIGINS`.
3. **Coding questions in Campus tests** — Monaco in the exam screen, Judge0 with hidden test cases
   (`coding_testcases` table from the plan doc), partial scoring per test case.
4. **Question bank import per college** — the Forge admin already has a staged spreadsheet import
   (`apps/admin/src/pages/ContentImport.tsx`); expose a college-scoped version in the Campus portal.
5. **Placement-officer dashboard v1** — batch/department results, attempt completion, CSV export (results CSV
   exists per assignment; needs cross-assignment rollups).
6. **Skill evidence from Campus attempts** (first slice of §4) so the student's result page can say *what to
   practise*, and link straight to the matching Forge problems/chapters.
7. **Owner actions from the handoff**: rotate the exposed admin password and GitHub token key; enable leaked-
   password protection; remove the fabricated landing-page numbers ("10,847 students") before any college demo.

---

## 6. Module-by-module audit (the 60 modules)

### 1. Student identity & account — 🟡
✅ Email/password and phone OTP sign-up (`apps/api/src/modules/auth`, `/auth/phone-send-otp`); profile; GitHub
OAuth for projects (`apps/web/src/lib/githubOAuth.ts`); multi-college accounts (Campus `org_memberships`, one
user in many orgs); session revocation on sign-out (phase 0).
❌ Social login (Google), MFA, device/session management UI, login history, consent records, data export,
account deletion, digital student ID, profile completion score.
**When:** Google sign-in limited to college domain **P2**; consent + data export/deletion **P2** (DPDP Act);
MFA for staff roles **P2**; device management **Later**.

### 2. College & organisation management — 🟡
✅ Multi-tenant orgs with DB-enforced isolation, departments, batches, batch members/faculty, bulk roster CSV
with per-line validation, branding (logo, colour), Forge-staff college creation
(`apps/campus-api/src/routes/org.ts`, `platform.ts`; migration `20261008000002_campus_tenancy.sql`).
❌ Semester/academic year, sections, multi-campus, academic & holiday calendars, custom domain, white-label,
org-level billing (`org_subscriptions` designed, not built), tenant analytics.
**When:** academic year + semester on batches **P2**; org subscriptions & seat limits **P2**; custom domains **P3**.

### 3. Role-based access & permissions — 🟡
✅ Seven college roles + platform roles; permission keys mapped to roles (`campus.role_permissions`), enforced in
RLS and `requirePermission`; Forge admin RBAC with roles/permissions (`apps/admin/src/pages/Permissions.tsx`).
❌ Per-org custom role builder, ABAC, approval workflows, impersonation audit, HOD/parent/auditor dashboards.
**When:** custom roles per college **P3**; HOD = department-scoped faculty view **P2**. ABAC — **Skip** (RBAC + RLS suffices).

### 4. Student dashboard — 🟡
✅ Forge dashboard: streak, XP, level, solved count, daily missions/quests, activity heatmap, continue-learning,
knowledge-graph & career-readiness widgets (`apps/web/src/pages/Index.tsx`); **new:** college tests card.
❌ Placement readiness score from real evidence, skill radar, AI learning summary, study-time analytics, upcoming
deadlines across Forge + college.
**When:** readiness + skill radar fed by §4 **P1–P2**.

### 5. Learning management system — 🟡
✅ Courses → chapters with video, text, interactive steps, visualizer, quizzes, notes, auto-notebook, YouTube
integration, resume learning, completion tracking, drip by phase; admin course/chapter editors and content import.
❌ College-authored courses (Campus has tests only), learning paths per college, cohort scheduling, SCORM/xAPI/LTI,
course versioning, discussions per course, ratings, offline.
**When:** college-authored courses + licensing Forge courses (`content_shares`) **P2**; LTI 1.3 via ltijs **P3**;
SCORM/xAPI **Later**.

### 6. AI-powered learning — 🟡
✅ AI mentor page + global assistant (`AICoachPage.tsx`, `GlobalAIAssistant.tsx`), mentor context, usage limits via
entitlements (`ai_queries_per_day`), OpenAI + Anthropic SDKs configured; AI help in apprenticeship projects.
❌ Context from Campus results, adaptive paths, AI quiz/flashcard/summary generators, spaced repetition, confidence
indicators, citations, Hinglish mode, voice.
**When:** mentor reads skill mastery (§4) **P2**; AI practice-question generator for weak skills **P2**;
Hinglish mode **P2** (cheap, high value in India); voice **Later**.

### 7. AI agent system — ❌
Nothing agentic beyond chat. **When:** start with two narrow, human-approved agents — *Faculty assistant*
(generate a question set from a syllabus → faculty review queue) **P2** and *Remedial plan* (gap → plan) **P2**.
Multi-agent orchestration **Later**. Every agent writes to an approval queue, never directly to students.

### 8. Programming language learning — 🟡
✅ In-browser runtimes for C++ (JSCPP), Java (Judge0 / dev JDK), JavaScript, Python (Pyodide)
(`apps/web/src/modules/CodeExecutor/runtimes/*`); language courses as content.
❌ Go/Rust/Kotlin/etc. (Judge0 supports 60+ — config, not code), syntax references, code-tracing / output-
prediction exercise types.
**When:** route all non-JS languages through Judge0 **P2**; output-prediction & debugging question types **P2**.

### 9. Online coding IDE — 🟡
✅ Monaco editor, run/submit, stdin, test-case results, workspace pages, GitHub repo integration for projects.
❌ Multi-file explorer, terminal, version history, AI code review/explanation inside the editor, mobile coding.
**When:** AI explain-my-error **P2**; multi-file **Later** (build challenges already use GitHub for that).

### 10. Coding practice platform — ✅ / 🟡
✅ Problem library by topic/pattern/difficulty, solved/tried/revision tracking, submissions, patterns admin,
categories. ❌ Company-wise lists, editorials/community solutions, problem of the day, progressive hints.
**When:** company tags + curated sheets **P2** (content work); POTD **P2**.

### 11. Data structures & algorithms — 🟡
✅ DSA roadmap content, interactive visualizer step in chapters, pattern-wise problems.
❌ Recursion-tree / call-stack / DP-table visualisations, dry-run builder, mastery tracking per topic.
**When:** mastery per DSA topic falls out of §4 **P2**; more visualisers **Later**.

### 12. Assessment engine — 🟡 (strong core)
✅ Two engines sharing ideas: Test Series CBT (sections, negative marking, NAT, mark-for-review, server timer —
`apps/web/src/pages/testseries/CBTTestPage.tsx`) and Campus assignments (`packages/assessment-core`): seeded
per-attempt question/option shuffling, attempt limits, open/close windows, result release rules, autosave, resume
after crash, scoring on the questions dealt, server-only scoring.
❌ Coding questions, section time limits/locking, question pools (draw N of M), adaptive tests, re-evaluation
requests, accommodations (extra time per student — `attempt_overrides` designed), approval workflow, templates.
**When:** coding questions + question pools + per-student extra time **P1**; section timing **P2**; adaptive **P3**.
**Debt:** two engines → plan to make Test Series use `assessment-core` too (one scorer, one exam UI).

### 13. Question bank — 🟡
✅ `testseries_questions` with MCQ/MSQ/NAT, passages (question groups), topic & difficulty, owner org + visibility,
admin question bank page, staged spreadsheet import.
❌ Coding/SQL/subjective/match/ordering types, Bloom's/CO mapping, review workflow, usage & discrimination stats,
exposure tracking, college-scoped import.
**When:** coding type + college import **P1**; subjective + grading queue **P2**; item statistics **P2** (cheap,
uses attempts already stored); Bloom/CO mapping **P3** (accreditation).

### 14. AI assessment generation — ❌
**When:** AI MCQ + distractor generator into a **human review queue** **P2**; AI hidden-test-case generator,
validated by running the reference solution on Judge0 **P2**. Never auto-publish AI questions.

### 15. Online judge & evaluation — 🟡
✅ Judge0 integration for Java (`apps/api/src/modules/execution/services/judge0.service.ts`) with prod-only-via-
Judge0 rule; Docker verification worker for build challenges (`apps/api/src/workers/verification.worker.ts`);
BullMQ queues.
❌ Hidden test cases per question, verdicts (TLE/MLE/WA) surfaced to students, partial scoring, special checkers,
judge capacity monitoring.
**When:** **P1** together with coding questions; load-test Judge0 at 2× the pilot batch before the exam date.

### 16. Aptitude & employability — ❌
Engine can already run aptitude tests (MCQ/NAT). Missing is **content**. **When:** **P2** — buy/licence or author
a starter bank (quant, logical, verbal) — this is what TPOs ask for first.

### 17. Company-wise placement prep — ❌
**When:** company profiles (pattern, syllabus, cutoffs) + company mock tests **P2**; readiness-per-company uses
`readiness_profiles` from §4.

### 18. AI career intelligence — 🟡
✅ Jobs board, apprenticeships, client-side career readiness, resume ATS score.
❌ JD analysis, role recommendation, explainable readiness. **When:** explainable readiness **P2** (§4);
JD-vs-resume match **P2**; salary/trend analysis **Skip** (needs data we don't have).

### 19. Resume & portfolio — ✅ / 🟡
✅ Resume builder with templates, ATS score, server-side persistence (`resume.service.ts`), certificates showcase,
GitHub projects. ❌ AI rewrite, JD matching, public portfolio page (`/profile/:username` not built).
**When:** public profile + verified-skills section **P2** (feeds the skill passport).

### 20. Interview preparation — ❌
Only an entitlement flag exists ("mock interview" in plans). **When:** AI text mock interview (DSA + HR) **P2**;
voice/video **Later**.

### 21. System design & SE — 🟡
✅ Build challenges cover real engineering (Docker, Git). ❌ System-design content, diagram exercises.
**When:** content **Later**.

### 22. Project-based learning — ✅
✅ Staged build challenges with GitHub submission and Docker verification, vibe-coding mode, apprenticeships with
projects, submissions, community posts, certificates. ❌ College-authored challenges, team projects, rubric grading.
**When:** college-authored challenges **P2** (plan doc), rubric grading **P2**.

### 23. Faculty & trainer portal — 🟡
✅ Campus portal: tests + editor, assignments with lockdown settings, results with every batch student and
violations, CSV export, batches, people, roster upload (`apps/campus/src/pages/*`).
❌ Faculty dashboard with at-risk students, attendance, announcements, doubt queue, grading queue, per-student report.
**When:** per-student report + at-risk list (from §4) **P2**; announcements **P2**; grading queue with subjective **P2**.

### 24. Placement officer & T&P cell — ❌
Role exists (`placement_officer`), no screens. **When:** dashboard v1 **P1** (§5); eligibility filters
(CGPA/backlogs on `student_profiles`) + drive management **P2**; offers/packages stats **P3**.

### 25. Learning analytics — 🟡
✅ Analytics event pipeline (now writing to the real schema), admin analytics, assignment results.
❌ Cohort/batch benchmarking, question-level analytics, percentiles/ranks, drop-off.
**When:** batch benchmarking + item stats **P2**; custom report builder **Skip** (CSV export + fixed reports first).

### 26. AI-powered analytics — ❌
**When:** "AI summary of this batch's results" on the results page **P2** (one prompt over aggregates, no PII);
ask-your-data **Later**.

### 27. Live classes — ❌
**When:** scheduled Meet/Zoom links + attendance on join **P2** (plan doc: no video built in-house). Everything else **Skip**.

### 28. Assignments & homework — 🟡
✅ Assignments = tests to batches with windows, attempts, release rules. ❌ Written/file/GitHub/notebook assignment
types, late rules, peer grading. **When:** GitHub-repo assignments reusing build verification **P2**; file upload **P2**.

### 29. Attendance & engagement — ❌
**When:** live-class attendance **P2**; QR attendance **Later**. Engagement score falls out of skill evidence + activity.

### 30. Gamification — ✅ / 🟡
✅ XP, levels, identity titles, streaks, daily quests, missions, badges, build-challenge leaderboard, admin
gamification settings. ❌ College/batch leaderboards, contests, leagues.
**When:** batch leaderboard (opt-in per college) **P2**.

### 31. Community — 🟡
✅ Apprenticeship community posts. ❌ General forums, doubt forum, moderation.
**When:** doubt threads per question/chapter **Later**; moderation needed before any open forum.

### 32. Certificates & credentials — ✅ / 🟡
✅ Course/apprenticeship certificates, PDF, public verification page (`/certificates/:code`), revocation (admin).
❌ Assessment/skill certificates, Open Badges, QR. **When:** "verified skill" credential from §4 **P2**; Open Badges **Later**.

### 33. Proctoring & assessment security — 🟡 (browser layer done)
✅ Full-screen enforcement, tab-switch/blur/full-screen-exit detection, copy/paste/right-click blocking, warn-
first then violations, server-decided auto-submit, per-attempt shuffling, answers never sent during an attempt,
events stored per attempt (`campus.proctoring_events`) — **student UI shipped in this branch**.
❌ Webcam (face present / multiple faces), live proctor board, incident review & appeals, plagiarism / code
similarity, IP/device checks.
**When:** live invigilator board (Supabase Realtime over `proctoring_events`) **P2**; webcam face check with
MediaPipe **P2** — needs DPDP consent screen + retention policy first; code similarity **P2** with coding questions.

### 34. AI-era academic integrity — ❌
**When:** cross-student code similarity **P2**; *oral code defence* (AI asks the student to explain their own
submitted code, scored) **P3** — a genuine differentiator, and cheap once coding questions exist.

### 35. Contests & hackathons — ❌
**When:** campus coding contest = timed assignment + live leaderboard **P3**. ICPC/Codeforces rating **Skip**.

### 36. SQL & database practice — ❌
**When:** SQL questions via Judge0's SQLite **P2** (common in placement tests).

### 37. Data science / ML labs — ❌ · **Later** (Pyodide covers simple pandas/NumPy in-browser; GPU labs **Skip**).

### 38. Cloud / DevOps labs — 🟡
✅ Build challenges with Docker verification. ❌ Sandboxes, terminals. **Later.**

### 39. Communication & soft skills — ❌ · **Later** (AI conversation partner is the cheapest entry point).

### 40. Notifications — 🟡
✅ Email (Resend, `email.service.ts`), WhatsApp webhook service, admin notifications page for apprenticeships.
❌ In-app notification centre, deadline reminders, assignment/result alerts, preferences.
**When:** in-app + email for "new test assigned", "closes in 24h", "result released" **P1–P2** — students miss
tests without this.

### 41. Mobile & PWA — 🟡
✅ Responsive web; mobile bottom nav; the new exam screen works at 390 px (palette in a bottom sheet, no overflow).
❌ PWA install/offline, push. **When:** PWA manifest + offline shell **P2**; native apps **Skip**.

### 42. Multilingual & accessibility — ❌ / 🟡
❌ No i18n framework. 🟡 Radix components give keyboard/ARIA basics; the exam uses roles (radio/checkbox) and
live save status. **When:** i18n scaffolding + Hindi/Hinglish UI **P3**; WCAG pass on the exam screen **P2**.

### 43. Referral & growth — ✅
✅ Referral codes, tiers, fraud scoring, withdrawals, admin referrals. ❌ Campus ambassador program.
**When:** ambassador = referral tier + college tag **Later**.

### 44. Admin control centre — ✅ / 🟡
✅ Forge admin: users, courses, chapters, problems, patterns, CMS, plans, coupons, revenue, referrals, withdrawals,
leaderboard, gamification, AI config, audit logs, system health, network monitoring, experiments page, content
import, test-series admin. ❌ Feature flags, per-tenant config UI, maintenance mode, backup UI. **When:** feature
flags **P2** (needed to roll Campus features college by college).

### 45. Payments & monetisation — ✅ / 🟡
✅ Razorpay, plans, subscriptions, coupons (race-safe), per-course purchases, entitlements, GST fields, webhooks
with fallback activation. ❌ College licences / per-seat billing, invoices for institutions.
**When:** college licence = `org_subscriptions` + seat count, invoiced offline at first **P2**.

### 46. SaaS & enterprise — 🟡
✅ Tenant isolation proven by SQL suites in CI. ❌ Tenant provisioning UI beyond create-college, usage limits,
SSO/SCIM, SLAs. **When:** usage limits per tenant **P2**; SSO **P3**.

### 47. Integrations & APIs — 🟡
✅ Judge0, GitHub, Razorpay, Resend, WhatsApp, Google Sheets. ❌ LTI 1.3, Google Classroom, Zoom/Meet, public API,
webhooks out. **When:** Meet/Zoom links **P2**; LTI 1.3 **P3**; public API **Later**.

### 48. Data management & migration — 🟡
✅ Roster CSV import with preview and per-line errors; staged content import. ❌ Historical results import,
exports beyond CSV. **When:** question import per college **P1**; results history import **Later**.

### 49. Security & privacy — 🟡 (much improved this month)
✅ RLS on every public table; Campus isolation suites (36 + 43 checks) in CI; service-role key server-only; JWT
verified locally (ES256 JWKS); rate limits; helmet; CORS allow-list; Java execution isolated in Judge0.
❌ MFA, consent management, data export/deletion workflows, leaked-password protection (dashboard toggle off),
3 functions with mutable `search_path`, secrets rotation pending (handoff §8.5).
**When:** owner actions **now**; DPDP consent + deletion **P2** (before webcam proctoring).

### 50. Reliability & infrastructure — 🟡
✅ Redis/BullMQ, Sentry, Prometheus metrics, Grafana dashboard JSON, runbooks, release/rollback plan
(`docs/observability.md`, `docs/release-rollback-plan.md`). ❌ Load test at exam-day peak, status page.
**When:** load test **P1** (before the pilot exam date).

### 51. Search — 🟡 (client-side Fuse.js). Global search **Later**.
### 52. Content creation — ✅ (admin editors, staged import, CMS). College-side authoring **P2**.
### 53. Library & resources — 🟡 (notebook, notes, chapter docs). Formula/cheat sheets **Later**.
### 54. Mentorship & support — ❌ (AI mentor only). Human mentor booking **Later**.
### 55. Parent portal — ❌ · **Skip** for engineering colleges (low demand); revisit for schools.
### 56. Institutional reports & accreditation — ❌ · CO-PO mapping + NAAC/NBA exports **P3** (needs question→CO tags).
### 57. Gamified campus ecosystem — ❌ · inter-college leaderboards **P3** (strong marketing value, opt-in only).
### 58. Innovation features — 🟡 · skill graph / skill passport are §4 — **the** innovation to build first. Others **Later**.
### 59. Differentiation — see §8.
### 60. Product feedback — 🟡 (feedback admin page, experiments page). In-app feedback widget **P2**.

---

## 7. Shipped in this branch — student side of Forge Campus (Slice E)

Matches the existing Forge design language (glass cards, Space Grotesk headings, blue = action, orange = reward /
in progress), light and dark, phone and desktop.

| Where | What |
|---|---|
| Sidebar + mobile drawer | **My College** entry, shown only to students of a Campus college (`AppLayout.tsx`) |
| Dashboard | College tests card — next tests with deadlines (`features/campus/CollegeTestsWidget.tsx`) |
| `/college` | College header (logo/brand colour, roll no.), stats, *Do this next*, tabs To do / Upcoming / Past, Start / Resume / Retake / View result, "Missed", proctored badge; friendly not-connected page with the signed-in email and steps (`pages/campus/MyCollegePage.tsx`) |
| `/college/tests/:id` | Instructions with faculty notes and the exact proctoring rules → full-screen exam: server-corrected timer, instant autosave with retry and offline banner, mark for review, passage + section display, palette (sidebar / bottom sheet on mobile), submit summary; lockdown: full-screen gate, tab-switch/blur reporting with de-duplication, copy/paste/right-click blocked, warning then violation dialogs, auto-submit (`pages/campus/CampusExamPage.tsx`, `features/campus/useLockdown.ts`) |
| `/college/attempts/:id` | Result: score ring, correct/wrong/skipped, question-by-question map, timeout/violation explanation, "results not released yet" state, next steps into Forge practice and the AI mentor (`pages/campus/CampusResultPage.tsx`) |

Campus API changes (both tested): the student assignment list now includes the proctoring policy (so rules are
shown before Start), and the result breakdown is reported in the order the student saw (it previously used the
test's original order, so "Question 2" on the result page was a different question from the exam).

**Verified:** 22/22 Campus API integration tests (one new assertion, which failed before the fix); 11 new web unit
tests; web production build; full browser run against the real Campus API and Postgres with RLS — roster claim on
first sign-in, start → answer → warning → violation → full-screen gate → copy blocked → refresh & resume (answers
kept) → submit → result, phone layout without horizontal overflow, Forge-only learner sees no link and cannot open
a test, dark mode. Zero console errors.

**Run locally:** start `apps/campus-api` (port 5100) and `apps/web`; the web dev server proxies `/campus/v1` to it
(`CAMPUS_API_URL` overrides). Production: set `VITE_CAMPUS_API_URL` and add the web origin to `CORS_ORIGINS`.

---

## 8. Differentiation — what to say no to, and what to lead with

The inventory warns that more features ≠ better product. Recommended stance:

**Lead with (no competitor has all four):**
1. **Verified skill evidence** — GitHub-verified projects + proctored tests + coding submissions → one skill graph → a
   public, verifiable *skill passport*.
2. **Explainable placement readiness per company** — "62% ready for TCS NQT, close the gap with these 3 topics".
3. **One-click remediation** — a result page that turns gaps into a plan in Forge's existing content.
4. **Faculty time saved** — AI-drafted question sets into a review queue; auto-graded coding; batch AI summaries.

**Say no to (for now):** native mobile apps, parent portal, ML/GPU labs, cloud sandboxes, custom report builder,
ABAC, voice/video interviews, in-house video conferencing, Codeforces-style ratings, salary benchmarking.

## 9. Risks

| Risk | Mitigation |
|---|---|
| `main` API breaks against the locked-down DB | Merge the stack before any deploy from `main` (§2) |
| Diverged audit branch silently dropped | Cherry-pick its security/money-path commits; record the decision |
| Two assessment engines drift | Converge Test Series onto `assessment-core` |
| Exam-day spike (whole college at 10:00) | Load test API + Judge0 at 2× pilot batch; queue code runs |
| Webcam data under DPDP Act 2023 | Consent screen, snapshots only on flags, auto-delete, per-college policy |
| Fabricated landing-page numbers | Remove before any college demo (legal + trust) |
| AI-generated questions with wrong keys | Mandatory human review queue; validate coding keys on Judge0 |
