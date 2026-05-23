# Learning Haven Project Audit

## Scope

This audit covers the maintained project code and project-owned assets in this repository:

- Root student-facing frontend in `src/`
- Separate admin frontend in `admin/src/`
- Backend API and workers in `backend/src/`
- SQL migrations, scripts, content, docs, and seed data

This audit intentionally excludes generated or vendor material:

- `node_modules/`
- `dist/`
- `admin/dist/`
- `backend/dist/`
- `.git/`
- local virtual environments and cache folders

Repository date inspected: `2026-04-28`

---

## Executive Summary

Learning Haven is a multi-application learning platform with four major slices:

1. `src/`: the learner-facing product for DSA learning, profile/progress, AI coach, referrals, jobs, resume tools, certificates, and the apprenticeship student experience.
2. `admin/src/`: the internal operations console for content, users, finance, system settings, and the apprenticeship program back office.
3. `backend/src/`: an Express + TypeScript API backed primarily by Supabase, with Redis/BullMQ workers, GitHub automation, Razorpay, Resend, OpenAI, and WhatsApp integrations.
4. `apprenticeship-platform/`: a schema/package slice for the apprenticeship module, intended to be portable but already integrated into this repo.

The product vision is broader than a normal DSA tracker:

- DSA roadmap and chapter learning
- AI coaching
- coding execution/playground
- premium plans and payments
- referrals and withdrawals
- certificates
- apprenticeship programs with repo provisioning, GitHub webhooks, Docker-based verification, community discussion, analytics, and admin review

---

## High-Level Architecture

### Runtime topology

- Browser app 1: root Vite app served from repository root
- Browser app 2: admin Vite app served from `admin/`
- API server: Express app in `backend/`
- Queue worker side effects: imported at backend startup from `email.worker` and `verification.worker`
- Primary data store: Supabase Postgres plus Supabase Auth
- Direct SQL access: `pg` pool for queries that bypass or complement Supabase client access
- Cache and queue infra: Redis + BullMQ
- External systems: GitHub OAuth/webhooks, Razorpay, OpenAI, Resend, Firebase Admin, WhatsApp Cloud API

### Request and data flow

1. Frontends authenticate through backend `/api/auth/*`.
2. Backend delegates identity to Supabase Auth and stores profile data in `public.users`.
3. Frontends call REST endpoints via Axios wrappers.
4. Admin routes are protected by `authenticateUser` + `requireAdmin`.
5. Apprenticeship project verification is event-driven:
   - student connects GitHub
   - backend provisions repo from template
   - GitHub push webhook creates submission
   - BullMQ worker runs Docker verification
   - results are persisted to Supabase and broadcast via Supabase Realtime channels
6. Root frontend subscribes to those submission updates and refreshes workspace state.

### Design characteristics

- Strong feature concentration around Supabase-backed CRUD
- React Query is the main frontend data-sync layer
- Pages are often heavy and own significant UI logic directly
- Backend uses thin route/controller layers over service modules
- Apprenticeship module is the most mature domain slice with clear boundaries
- Several older DSA pages still rely on mock/local data while newer flows use APIs

---

## Product Capabilities By Surface

### Student frontend

- landing and auth
- dashboard and roadmap/chapter learning
- AI coach chat history and quota
- topic/problem visualizer
- profile, certificates, referrals, jobs, resume
- apprenticeship catalog, checkout, enrollments, dashboard, project workspace, certificate verification
- in-browser code execution playground

### Admin frontend

- dashboard and analytics
- user management
- problem/category/pattern/roadmap/task management
- feedback and referrals
- plans and withdrawals
- AI/system/leaderboard settings
- audit logs
- apprenticeship operations: programs, projects, submissions, students, analytics, coupons, notifications

### Backend

- auth and profile/stats
- roadmap/chapter/progress APIs
- problem/submission APIs
- AI coach and usage controls
- payments/subscriptions/certificates/referrals
- admin CRUD and reports
- apprenticeship public, private, and admin APIs
- GitHub OAuth + webhook automation
- verification worker + certificate issuance + project pass cascade

---

## Backend Deep Dive

### Application bootstrap

- `backend/src/server.ts` starts the HTTP server.
- `backend/src/app.ts` configures Express, CORS, Helmet, compression, JSON parsing, mounts `/api`, and imports workers for side effects.
- `backend/src/routes/index.ts` is the central route aggregator.

### Auth and authorization

- `authenticateUser` verifies a bearer token with Supabase Auth and has a development JWT fallback.
- `requireAdmin` and `requireSuperAdmin` resolve role from `public.users`.
- Admin UI stores token in `localStorage.token`; student UI stores `localStorage.auth_token`.

### Persistence

- `backend/src/config/database.ts` creates:
  - Supabase client using service role or anon key
  - `pg` pool using `DATABASE_URL`
- Supabase is the primary operational persistence interface.
- Raw SQL pool is used where better control or bypassing RLS is needed.

### Queue and verification pipeline

- GitHub push webhook creates apprenticeship submissions.
- BullMQ queue name: `apprenticeship-verification`.
- `backend/src/workers/verification.worker.ts`:
  - clones exact commit
  - runs Docker verification image
  - logs per-stage results
  - updates submission status, scores, test counts, console tail, XP
  - unlocks next project or flags review
  - emits events and realtime broadcasts
  - issues pass cascade side effects including certificates and email

### Apprenticeship module

This is the most complete bounded context in the repo.

- `programs.service.ts`: public/admin program reads and writes, caching, reorder logic
- `projects.service.ts`: workspace and project progression logic
- `submissions.service.ts`: student/admin submission queries and stage queries
- `tracking.service.ts`: event ingestion and analytics storage
- `admin.service.ts`: admin analytics, student detail, review flows, coupons, notifications
- `certificates.service.ts`: apprenticeship certificate issuance/verification
- `enrollment.controller.ts`: payment order creation and enrollment completion
- `community.controller.ts`: program/project scoped discussion feed
- `ai-help.controller.ts`: apprenticeship-context AI debugging help

### GitHub integration

- OAuth URL generated per user with state carrying user id
- callback exchanges code for access token and stores encrypted token in Supabase
- repo provision uses GitHub template repositories
- repo webhook posts back into `/api/v1/apprenticeship/webhooks/github`
- webhook secret is per provisioned repo
- only `push` to `main` triggers verification jobs

### Payment and commerce

- General product payments live under `/api/payments` and `/api/subscriptions`
- Apprenticeship checkout has a separate flow under `/api/v1/apprenticeship/payments/create-order` and `/api/v1/apprenticeship/enroll`
- Razorpay configuration is centralized in `backend/src/config/razorpay.ts`

### Notable backend risks

- `backend/src/routes/resume.ts` imports `requireRole` from auth middleware, but the inspected `auth.ts` file does not expose it. This likely indicates drift or an unresolved import.
- `backend/src/app.ts` imports workers unconditionally at API startup. This is simple operationally, but it couples API and worker lifecycles.
- Student chapter/dashboard pages still contain local mock structures, which means API-backed and mock-backed learning paths coexist.
- The student and admin frontends use different localStorage token keys, which is fine but worth documenting for debugging.

---

## Frontend Deep Dive

### Root frontend architecture

- `src/main.tsx` renders `App`.
- `src/App.tsx` sets up React Query, toasts, router, auth provider, and route tree.
- `src/context/AuthContext.tsx` performs token bootstrap and profile hydration.
- `src/components/ProtectedRoute.tsx` gates authenticated routes.
- `src/components/AppLayout.tsx` is the main learner shell with nav, theme toggle, user summary, and apprenticeship-aware navigation.

### Root frontend route model

Public/semi-public:

- `/`
- `/pricing`
- `/apprenticeships`
- `/apprenticeships/:slug`
- `/certificates/:code`
- auth pages under `/signin`, `/signup`

Protected:

- `/dashboard`
- `/chapters`
- `/chapter/:chapterId`
- `/visualizer`
- `/ai-coach`
- `/resume`
- `/referrals`
- `/certificates`
- `/profile`
- `/jobs`
- apprenticeship student routes

### Root frontend data strategy

- Generic Axios client in `src/services/api.svc.ts`
- Generic React Query helper in `src/hooks/useApi.ts`
- Feature-specific API wrapper in `src/services/apprenticeship.service.ts`
- Event batching in `src/lib/tracker.ts`
- Optional Supabase Realtime usage in apprenticeship workspace

### Code execution module

`src/modules/CodeExecutor/` is an independent mini-product:

- Monaco editor UI
- browser workers for JavaScript/Python/C++
- backend fallback for Java execution
- LeetCode/HackerRank style layouts
- supports both free-form playground execution and structured testcase validation

This module is reusable and more componentized than many of the page-level screens.

### Admin frontend architecture

- `admin/src/main.tsx` creates its own React Query client
- `admin/src/App.tsx` defines protected and public route shells
- `admin/src/context/AuthContext.tsx` enforces admin/super_admin roles
- `admin/src/layouts/DashboardLayout.tsx` provides the shell
- `admin/src/components/Sidebar.tsx` organizes sections by business area

### Admin frontend data strategy

- `admin/src/services/api.ts` configures authenticated Axios
- service files are mostly thin REST wrappers
- apprenticeship admin uses a dedicated service with envelope unwrapping and public/admin endpoints

---

## Data and Schema Assets

### Supabase migrations

- `backend/supabase/migrations/*` establish the core platform schema and later features.
- `backend/supabase/003_new_features.sql` appears to be an additive migration outside the timestamped chain.
- `apprenticeship-platform/supabase/migrations/*` defines apprenticeship-specific schema and scale indexes.

### Seed/content assets

- `data/chapters/*.json` store structured chapter content
- `scripts/seed-chapters.ts` and `backend/scripts/seed-chapters.ts` seed chapter data
- `content/PRODUCT_SPEC.md` and `content/PHASE_0_FULL_SPEC.md` capture product intent/spec language

---

## Source Inventory

The lists below enumerate maintained source files and their purpose. Repeated UI primitive wrappers are intentionally described succinctly.

### Root frontend files

#### App root and global assets

- `src/main.tsx`: root DOM mount.
- `src/App.tsx`: root providers and complete route tree.
- `src/App.css`: app-level styles.
- `src/index.css`: global design tokens and utility styling.
- `src/vite-env.d.ts`: Vite type declarations.

#### Auth, context, shared hooks, libs, services

- `src/context/AuthContext.tsx`: learner auth bootstrap, login, register, logout, user state.
- `src/hooks/useAnimatedCounter.ts`: numeric animation helper.
- `src/hooks/useApi.ts`: React Query convenience wrappers around `api`.
- `src/hooks/use-mobile.tsx`: responsive/mobile breakpoint helper.
- `src/hooks/useTheme.ts`: theme persistence/toggle helper.
- `src/hooks/use-toast.ts`: toast state hook.
- `src/lib/logger.ts`: frontend debug/error logger.
- `src/lib/supabase.ts`: optional Supabase client for Realtime use.
- `src/lib/tracker.ts`: apprenticeship event queue + beacon flush logic.
- `src/lib/utils.ts`: common utility helpers such as class merging.
- `src/services/api.svc.ts`: Axios client with auth and error interceptors.
- `src/services/apprenticeship.service.ts`: student apprenticeship API wrapper.
- `src/services/auth.service.ts`: auth and phone OTP API wrapper.

#### Shared layout and non-primitive components

- `src/components/AppLayout.tsx`: learner shell, nav, apprenticeship-aware menu, theme and profile panel.
- `src/components/HeatmapChart.tsx`: analytics heatmap visualization.
- `src/components/NavLink.tsx`: likely reusable nav link wrapper.
- `src/components/NotesModal.tsx`: note capture/display modal.
- `src/components/PomodoroTimer.tsx`: study timer UI.
- `src/components/ProgressRing.tsx`: circular progress indicator.
- `src/components/ProtectedRoute.tsx`: auth gate wrapper.
- `src/components/StatCard.tsx`: reusable metric card.
- `src/components/layouts/AuthLayout.tsx`: auth page wrapper layout.

#### Chapter-specific components

- `src/components/chapter/CelebrationOverlay.tsx`: completion/celebration overlay.
- `src/components/chapter/CheatsheetSection.tsx`: chapter cheatsheet presentation.
- `src/components/chapter/MiniQuiz.tsx`: lightweight quiz UI.
- `src/components/chapter/ProblemsSection.tsx`: practice problem block.
- `src/components/chapter/QuizSection.tsx`: full quiz block.
- `src/components/chapter/StoryHook.tsx`: narrative intro block.
- `src/components/chapter/TaskSection.tsx`: task/practice CTA block.
- `src/components/chapter/UnlockSection.tsx`: progression/unlock UI.
- `src/components/chapter/VideoSection.tsx`: learning video block.

#### Onboarding components

- `src/components/onboarding/OnboardingStep.tsx`: onboarding step renderer.
- `src/components/onboarding/OptionButton.tsx`: onboarding option button.

#### UI primitive wrappers

- `src/components/ui/accordion.tsx`: accordion primitive wrapper.
- `src/components/ui/alert-dialog.tsx`: alert dialog wrapper.
- `src/components/ui/alert.tsx`: alert wrapper.
- `src/components/ui/aspect-ratio.tsx`: aspect ratio wrapper.
- `src/components/ui/avatar.tsx`: avatar wrapper.
- `src/components/ui/badge.tsx`: badge wrapper.
- `src/components/ui/breadcrumb.tsx`: breadcrumb wrapper.
- `src/components/ui/button.tsx`: button wrapper.
- `src/components/ui/calendar.tsx`: calendar wrapper.
- `src/components/ui/card.tsx`: card wrapper.
- `src/components/ui/carousel.tsx`: carousel wrapper.
- `src/components/ui/chart.tsx`: chart wrapper.
- `src/components/ui/checkbox.tsx`: checkbox wrapper.
- `src/components/ui/collapsible.tsx`: collapsible wrapper.
- `src/components/ui/command.tsx`: command palette wrapper.
- `src/components/ui/context-menu.tsx`: context menu wrapper.
- `src/components/ui/dialog.tsx`: dialog wrapper.
- `src/components/ui/drawer.tsx`: drawer wrapper.
- `src/components/ui/dropdown-menu.tsx`: dropdown menu wrapper.
- `src/components/ui/form.tsx`: form wrapper.
- `src/components/ui/hover-card.tsx`: hover card wrapper.
- `src/components/ui/input-otp.tsx`: OTP input wrapper.
- `src/components/ui/input.tsx`: text input wrapper.
- `src/components/ui/label.tsx`: label wrapper.
- `src/components/ui/menubar.tsx`: menubar wrapper.
- `src/components/ui/navigation-menu.tsx`: nav menu wrapper.
- `src/components/ui/pagination.tsx`: pagination wrapper.
- `src/components/ui/popover.tsx`: popover wrapper.
- `src/components/ui/progress.tsx`: progress bar wrapper.
- `src/components/ui/radio-group.tsx`: radio group wrapper.
- `src/components/ui/resizable.tsx`: resizable panel wrapper.
- `src/components/ui/scroll-area.tsx`: scroll area wrapper.
- `src/components/ui/select.tsx`: select wrapper.
- `src/components/ui/separator.tsx`: separator wrapper.
- `src/components/ui/sheet.tsx`: sheet wrapper.
- `src/components/ui/sidebar.tsx`: sidebar wrapper.
- `src/components/ui/skeleton.tsx`: skeleton loader wrapper.
- `src/components/ui/slider.tsx`: slider wrapper.
- `src/components/ui/sonner.tsx`: Sonner toast mount.
- `src/components/ui/switch.tsx`: switch wrapper.
- `src/components/ui/table.tsx`: table wrapper.
- `src/components/ui/tabs.tsx`: tabs wrapper.
- `src/components/ui/textarea.tsx`: textarea wrapper.
- `src/components/ui/toaster.tsx`: toast mount.
- `src/components/ui/toast.tsx`: toast primitive wrapper.
- `src/components/ui/toggle-group.tsx`: toggle group wrapper.
- `src/components/ui/toggle.tsx`: toggle wrapper.
- `src/components/ui/tooltip.tsx`: tooltip wrapper.
- `src/components/ui/use-toast.ts`: lower-level toast hook.

#### Data

- `src/data/chapters.ts`: mixed API-backed types plus mock phase/mission structures used by older dashboard/chapter UI.

#### Pages

- `src/pages/LandingPage.tsx`: marketing landing page focused on guided DSA for tier 3/4 students.
- `src/pages/Pricing.tsx`: pricing/plans presentation.
- `src/pages/Index.tsx`: learner dashboard using profile stats, settings, and mock phase data.
- `src/pages/TopicsPage.tsx`: topic listing and filtering UI.
- `src/pages/ChaptersOverviewPage.tsx`: roadmap chapter progression view.
- `src/pages/ChapterPage.tsx`: chapter consumption flow; currently heavy on local/mock mission structures.
- `src/pages/PhaseCompletionPage.tsx`: end-of-phase celebration/summary UI.
- `src/pages/VisualizerPage.tsx`: algorithm/pattern visualizer with related problems.
- `src/pages/AICoachPage.tsx`: AI chat page with history, usage, quick actions, and clear-history support.
- `src/pages/ResumePage.tsx`: resume improvement/generation interface.
- `src/pages/JobsPage.tsx`: jobs browsing UI.
- `src/pages/ReferralsPage.tsx`: referral dashboard and withdrawal flow UI.
- `src/pages/CertificatesPage.tsx`: user certificate list/verification UI.
- `src/pages/ProfilePage.tsx`: learner profile and performance summary.
- `src/pages/RoadmapPreview.tsx`: preview page before full journey.
- `src/pages/Onboarding.tsx`: onboarding questionnaire/flow.
- `src/pages/NotFound.tsx`: fallback 404 page.
- `src/pages/ApprenticeshipsPage.tsx`: public apprenticeship discovery and filters.
- `src/pages/ApprenticeshipProgramPage.tsx`: program detail, checkout initiation, referral/coupon capture, Razorpay flow.
- `src/pages/ApprenticeshipDashboardPage.tsx`: student overview of apprenticeship enrollments.
- `src/pages/ApprenticeshipEnrollmentPage.tsx`: project list for a single enrollment.
- `src/pages/WorkspacePage.tsx`: main apprenticeship workspace with guide, tests, GitHub connect, submissions, community, AI help.
- `src/pages/ApprenticeshipCertificatePage.tsx`: public certificate verification and sharing page.
- `src/pages/auth/SignIn.tsx`: email/password sign-in.
- `src/pages/auth/SignUp.tsx`: email/password sign-up.

#### Code executor module

- `src/modules/CodeExecutor/index.ts`: module export surface.
- `src/modules/CodeExecutor/types.ts`: domain types for questions, languages, testcases, execution results.
- `src/modules/CodeExecutor/constants.ts`: language options and default templates.
- `src/modules/CodeExecutor/logger.ts`: execution analytics/debug logger.
- `src/modules/CodeExecutor/CodeExecutionModule.tsx`: high-level wrapper component.
- `src/modules/CodeExecutor/CodeWorkspace.tsx`: orchestrates panels, layout, execution state.
- `src/modules/CodeExecutor/test-page.tsx`: playground/demo page for the executor.
- `src/modules/CodeExecutor/hooks/useCodeExecution.ts`: core state and run/submit orchestration.
- `src/modules/CodeExecutor/components/ConsolePanel.tsx`: testcase/result/console tabbed output.
- `src/modules/CodeExecutor/components/EditorPanel.tsx`: Monaco editor and toolbar.
- `src/modules/CodeExecutor/components/QuestionPanel.tsx`: question rendering panel.
- `src/modules/CodeExecutor/components/ResizeLayout.tsx`: layout behavior helper.
- `src/modules/CodeExecutor/components/WorkspaceHeader.tsx`: workspace header UI.
- `src/modules/CodeExecutor/runtimes/index.ts`: language dispatch.
- `src/modules/CodeExecutor/runtimes/javascript.ts`: browser worker-based JS execution.
- `src/modules/CodeExecutor/runtimes/python.ts`: Pyodide worker-based Python execution.
- `src/modules/CodeExecutor/runtimes/cpp.ts`: JSCPP worker-based C/C++ execution.
- `src/modules/CodeExecutor/runtimes/java.ts`: backend-assisted Java execution.
- `src/modules/CodeExecutor/runtimes/workerBase.ts`: worker URL resolution helper.

#### Tests

- `src/test/setup.ts`: test environment setup.
- `src/test/example.test.ts`: baseline/example test.

### Admin frontend files

#### App root and globals

- `admin/src/main.tsx`: admin entry point and query client.
- `admin/src/App.tsx`: admin providers and route tree.
- `admin/src/App.css`: admin-specific app styles.
- `admin/src/index.css`: admin global design tokens/utilities.
- `admin/src/assets/react.svg`: template asset, currently non-critical.

#### Auth, layout, shared helpers

- `admin/src/context/AuthContext.tsx`: admin auth bootstrap and role enforcement.
- `admin/src/layouts/DashboardLayout.tsx`: admin shell header + content outlet.
- `admin/src/components/Sidebar.tsx`: sectioned admin navigation.
- `admin/src/hooks/useDebounce.ts`: debouncing helper.
- `admin/src/lib/utils.ts`: utility helpers.
- `admin/src/types/auth.ts`: admin auth/user types.

#### UI primitive wrappers

- `admin/src/components/ui/badge.tsx`: badge wrapper.
- `admin/src/components/ui/button.tsx`: button wrapper.
- `admin/src/components/ui/card.tsx`: card wrapper.
- `admin/src/components/ui/checkbox.tsx`: checkbox wrapper.
- `admin/src/components/ui/dropdown-menu.tsx`: dropdown menu wrapper.
- `admin/src/components/ui/input.tsx`: input wrapper.
- `admin/src/components/ui/label.tsx`: label wrapper.
- `admin/src/components/ui/select.tsx`: select wrapper.
- `admin/src/components/ui/sonner.tsx`: toaster mount.
- `admin/src/components/ui/table.tsx`: table wrapper.
- `admin/src/components/ui/textarea.tsx`: textarea wrapper.

#### Services

- `admin/src/services/api.ts`: authenticated Axios client for admin.
- `admin/src/services/auth.service.ts`: login/profile/logout.
- `admin/src/services/admin.service.ts`: dashboard, analytics, settings, logs, leaderboard, AI config.
- `admin/src/services/apprenticeship.service.ts`: apprenticeship public/admin CRUD and actions.
- `admin/src/services/categories.service.ts`: category CRUD.
- `admin/src/services/feedback.service.ts`: feedback listing/status updates.
- `admin/src/services/patterns.service.ts`: pattern CRUD and linking.
- `admin/src/services/plans.service.ts`: plan CRUD.
- `admin/src/services/problems.service.ts`: problem listing, CRUD, import.
- `admin/src/services/referrals.service.ts`: referral stats/review actions.
- `admin/src/services/roadmaps.service.ts`: roadmap CRUD and ordering.
- `admin/src/services/tasks.service.ts`: admin task assignment actions.
- `admin/src/services/users.service.ts`: user listing, role changes, ban toggles.
- `admin/src/services/withdrawals.service.ts`: withdrawal listing and processing.

#### Pages

- `admin/src/pages/Login.tsx`: admin login screen.
- `admin/src/pages/Dashboard.tsx`: admin KPI overview.
- `admin/src/pages/Analytics.tsx`: platform analytics summary and breakdowns.
- `admin/src/pages/Users.tsx`: user management.
- `admin/src/pages/Problems.tsx`: problem listing and actions.
- `admin/src/pages/ProblemEditor.tsx`: create/edit problem form.
- `admin/src/pages/Categories.tsx`: category management.
- `admin/src/pages/Patterns.tsx`: pattern management and linking.
- `admin/src/pages/Roadmaps.tsx`: roadmap management.
- `admin/src/pages/Tasks.tsx`: task assignment UI.
- `admin/src/pages/Feedback.tsx`: feedback queue.
- `admin/src/pages/Referrals.tsx`: referrals review and stats.
- `admin/src/pages/Plans.tsx`: subscription plan management.
- `admin/src/pages/Withdrawals.tsx`: withdrawal approvals/rejections.
- `admin/src/pages/Leaderboard.tsx`: leaderboard configuration.
- `admin/src/pages/AIConfig.tsx`: AI config editor.
- `admin/src/pages/Settings.tsx`: system settings editor.
- `admin/src/pages/AuditLogs.tsx`: audit log browser.

#### Apprenticeship admin pages

- `admin/src/pages/apprenticeship/OverviewPage.tsx`: apprenticeship business summary.
- `admin/src/pages/apprenticeship/ProgramsPage.tsx`: program catalog and management entry.
- `admin/src/pages/apprenticeship/ProgramEditorPage.tsx`: create/edit program metadata and project ordering.
- `admin/src/pages/apprenticeship/ProjectEditorPage.tsx`: project authoring, guides, verification requirements, resources.
- `admin/src/pages/apprenticeship/SubmissionsPage.tsx`: live submission review and override controls.
- `admin/src/pages/apprenticeship/StudentsPage.tsx`: enrolled student list and health view.
- `admin/src/pages/apprenticeship/StudentDetailPage.tsx`: per-student enrollments, submissions, events, certificates.
- `admin/src/pages/apprenticeship/AnalyticsPage.tsx`: apprenticeship analytics reporting.
- `admin/src/pages/apprenticeship/CouponsPage.tsx`: coupon management.
- `admin/src/pages/apprenticeship/NotificationsPage.tsx`: broadcast notification UI.

### Backend files

#### App entry and config

- `backend/src/index.ts`: alternate entry placeholder/export root.
- `backend/src/server.ts`: bootstraps listening server.
- `backend/src/app.ts`: Express app, middleware, worker imports, health routes, error handler.
- `backend/src/config/database.ts`: Supabase client + pg pool.
- `backend/src/config/logger.ts`: backend logging configuration.
- `backend/src/config/openai.ts`: OpenAI client, model name, DSA coach prompt.
- `backend/src/config/razorpay.ts`: Razorpay client config.
- `backend/src/config/redis.ts`: Redis connection.

#### Middleware

- `backend/src/middleware/auth.ts`: bearer auth and optional auth.
- `backend/src/middleware/requireAdmin.ts`: admin/super_admin enforcement.
- `backend/src/middleware/requirePlan.ts`: plan-gated access.
- `backend/src/middleware/validate.ts`: schema validation middleware.
- `backend/src/middleware/adminLogging.ts`: admin action audit logging.
- `backend/src/middleware/apprenticeshipTracker.ts`: convenience event tracking middleware.

#### Route modules

- `backend/src/routes/index.ts`: route composition root.
- `backend/src/routes/auth.ts`: signup/signin/signout and phone OTP auth.
- `backend/src/routes/users.ts`: profile, stats, progress, study time, analytics.
- `backend/src/routes/problems.ts`: problem browse/detail/submit/hints/solution.
- `backend/src/routes/submissions.ts`: notes, revision toggle, leaderboard.
- `backend/src/routes/payments.ts`: plan order creation, verification, webhook, history.
- `backend/src/routes/subscriptions.ts`: plans/current/cancel.
- `backend/src/routes/referrals.ts`: referral info, code apply, leaderboard, withdrawal request.
- `backend/src/routes/ai.ts`: AI chat/history/usage.
- `backend/src/routes/certificates.ts`: generate/list/verify certificates.
- `backend/src/routes/admin.ts`: full admin API surface.
- `backend/src/routes/tasks.ts`: user task CRUD.
- `backend/src/routes/roadmaps.ts`: roadmap listing/detail and per-user chapter access.
- `backend/src/routes/categories.ts`: categories and patterns.
- `backend/src/routes/feedback.ts`: feedback submission/listing flow.
- `backend/src/routes/execute.ts`: code execution endpoints, especially Java backend execution.
- `backend/src/routes/chapters.ts`: chapter content/progress/unlock APIs.
- `backend/src/routes/cron.ts`: cron-triggered maintenance and WhatsApp automation actions.
- `backend/src/routes/jobs.ts`: jobs endpoints.
- `backend/src/routes/settings.ts`: public settings.
- `backend/src/routes/resume.ts`: AI resume improvement endpoint.
- `backend/src/routes/whatsapp.ts`: webhook receive/verification.

#### Controllers

- `backend/src/controllers/auth.controller.ts`: email auth flow.
- `backend/src/controllers/auth-phone.controller.ts`: OTP send/verify/profile completion flow.
- `backend/src/controllers/users.controller.ts`: user profile/stats/progress/activity endpoints.
- `backend/src/controllers/problems.controller.ts`: problem list/detail/hints/solution.
- `backend/src/controllers/submissions.controller.ts`: DSA submission actions and leaderboard.
- `backend/src/controllers/payments.controller.ts`: standard payment lifecycle.
- `backend/src/controllers/payments.public.controller.ts`: public payment helpers.
- `backend/src/controllers/referrals.controller.ts`: referral/reward/withdrawal behavior.
- `backend/src/controllers/ai.controller.ts`: AI chat/history/usage.
- `backend/src/controllers/certificates.controller.ts`: certificate generation/list/verification.
- `backend/src/controllers/admin.controller.ts`: broad admin action surface.
- `backend/src/controllers/tasks.controller.ts`: task CRUD.
- `backend/src/controllers/roadmaps.controller.ts`: roadmap list/detail.
- `backend/src/controllers/feedback.controller.ts`: feedback submit/manage.
- `backend/src/controllers/jobs.controller.ts`: jobs CRUD/listing.
- `backend/src/controllers/execute.controller.ts`: code execution backend handlers.
- `backend/src/controllers/settings.controller.ts`: public settings reads.
- `backend/src/controllers/subscriptions.controller.ts`: plan endpoints.
- `backend/src/controllers/resume.controller.ts`: AI resume improvement handler.
- `backend/src/controllers/whatsapp.controller.ts`: WhatsApp webhook handlers.

#### Core service layer

- `backend/src/services/admin.service.ts`: admin stats, lists, moderation, config persistence, logs, finance ops.
- `backend/src/services/ai.service.ts`: AI chat persistence, quotas, history.
- `backend/src/services/cache.service.ts`: generic cache support.
- `backend/src/services/categories.service.ts`: category/pattern/problem linking and import.
- `backend/src/services/certificates.service.ts`: standard certificate logic.
- `backend/src/services/chapters.service.ts`: chapter content, progress, unlock logic.
- `backend/src/services/email.service.ts`: Resend-backed email operations.
- `backend/src/services/feedback.service.ts`: feedback storage and status changes.
- `backend/src/services/googleSheets.service.ts`: CSV/Sheets import helper.
- `backend/src/services/javaExecutor.ts`: backend Java compile/run path.
- `backend/src/services/jobs.service.ts`: jobs domain logic.
- `backend/src/services/notes.service.ts`: submission notes persistence.
- `backend/src/services/payments.service.ts`: payment verification and subscription activation behavior.
- `backend/src/services/problems.service.ts`: DSA problem query logic.
- `backend/src/services/referrals.service.ts`: referral accounting and withdrawals.
- `backend/src/services/roadmaps.service.ts`: roadmap CRUD/order logic.
- `backend/src/services/status.service.ts`: status helpers/health logic.
- `backend/src/services/submissions.service.ts`: DSA submission storage and toggles.
- `backend/src/services/subscriptions.service.ts`: subscription plan and current-subscription logic.
- `backend/src/services/tasks.service.ts`: task CRUD.
- `backend/src/services/users.service.ts`: profile and metrics computation.
- `backend/src/services/whatsapp.service.ts`: WhatsApp outbound messaging and workflow logic.

#### Apprenticeship module

- `backend/src/modules/apprenticeship/routes.ts`: public/private/admin apprenticeship routes.
- `backend/src/modules/apprenticeship/http.ts`: success/fail envelope helpers.
- `backend/src/modules/apprenticeship/types.ts`: apprenticeship domain types.
- `backend/src/modules/apprenticeship/cache.ts`: module cache keys and helpers.
- `backend/src/modules/apprenticeship/programs.controller.ts`: public/student/admin program/project endpoints.
- `backend/src/modules/apprenticeship/programs.service.ts`: program CRUD, reads, cache invalidation, leaderboard, certificate verify.
- `backend/src/modules/apprenticeship/projects.service.ts`: workspace retrieval and project progress transitions.
- `backend/src/modules/apprenticeship/submissions.controller.ts`: student submission status/stages/list.
- `backend/src/modules/apprenticeship/submissions.service.ts`: apprenticeship submission reads and review support.
- `backend/src/modules/apprenticeship/tracking.controller.ts`: event ingestion endpoint.
- `backend/src/modules/apprenticeship/tracking.service.ts`: event persistence and analytics helpers.
- `backend/src/modules/apprenticeship/community.controller.ts`: post/reply/upvote endpoints.
- `backend/src/modules/apprenticeship/ai-help.controller.ts`: contextual AI debugging help.
- `backend/src/modules/apprenticeship/enrollment.controller.ts`: apprenticeship order/enrollment flow.
- `backend/src/modules/apprenticeship/certificates.service.ts`: apprenticeship certificate issue/verify.
- `backend/src/modules/apprenticeship/admin.service.ts`: apprenticeship admin overview, analytics, student detail, reviews, coupons, notifications.

#### GitHub module

- `backend/src/modules/github/routes.ts`: standalone GitHub route mount variant.
- `backend/src/modules/github/github.controller.ts`: GitHub status, OAuth callback, webhook receiver, queue enqueueing.
- `backend/src/modules/github/github.service.ts`: token encryption, OAuth exchange, repo provisioning, webhook creation.

#### Utilities

- `backend/src/utils/badges.ts`: badge calculation helpers.
- `backend/src/utils/plans.ts`: plan utility helpers.
- `backend/src/utils/streak.ts`: streak calculations.
- `backend/src/utils/validators.ts`: request schema definitions.
- `backend/src/utils/xp.ts`: XP calculation helpers.

#### Workers

- `backend/src/workers/email.worker.ts`: background email processing.
- `backend/src/workers/verification.worker.ts`: apprenticeship verification pipeline.

#### Backend internal scripts under `backend/src/scripts/`

- `backend/src/scripts/test_all_apis.sh`: API smoke/integration shell helper.
- `backend/src/scripts/verify_system.ts`: backend/system verification helper.

### SQL, scripts, docs, and content

#### Root scripts

- `scripts/compile-server.js`: local compile server bootstrap for code execution fallback.
- `scripts/seed-chapters.ts`: root-level chapter seeding script.

#### Backend scripts

- `backend/scripts/create-admin.ts`: admin account creation.
- `backend/scripts/create-otp-table.sql`: OTP table creation SQL.
- `backend/scripts/create-super-admin.js`: super admin bootstrap.
- `backend/scripts/generate-token.js`: token generation helper.
- `backend/scripts/generate-token.ts`: TypeScript version of token generation helper.
- `backend/scripts/list-users.js`: user listing helper.
- `backend/scripts/run-migration.js`: migration runner.
- `backend/scripts/run-sql.js`: ad hoc SQL runner.
- `backend/scripts/seed-chapters.ts`: backend chapter seeding.
- `backend/scripts/seed-dynamic-settings.ts`: settings seed.
- `backend/scripts/seed-pg.js`: raw Postgres seed helper.
- `backend/scripts/seed-plans.ts`: plan seed.
- `backend/scripts/seed-roadmaps.ts`: roadmap seed.
- `backend/scripts/update-role-admin.js`: role promotion helper.
- `backend/scripts/update-user-role.js`: generic role update helper.
- `backend/scripts/upsert-user.js`: user upsert helper.

#### Migrations and schema files

- `backend/supabase/migrations/20260215000001_init.sql`: core schema bootstrap.
- `backend/supabase/migrations/20260215000003_add_study_time.sql`: study-time related additions.
- `backend/supabase/migrations/20260216000001_add_problems.sql`: problem-related schema.
- `backend/supabase/migrations/20260216000002_advanced_admin.sql`: advanced admin schema additions.
- `backend/supabase/003_new_features.sql`: later feature additions outside timestamp chain.
- `apprenticeship-platform/supabase/migrations/20260428_apprenticeship_platform.sql`: apprenticeship schema.
- `apprenticeship-platform/supabase/migrations/20260428_apprenticeship_scale_indexes.sql`: apprenticeship performance/index tuning.

#### Docs and specs

- `README.md`: mostly Lovable/Vite boilerplate, not a reliable architecture doc.
- `admin/README.md`: Vite template boilerplate.
- `apprenticeship-platform/README.md`: concise description of apprenticeship slice and integration points.
- `docs/CPP-WASM-EXECUTION.md`: notes on browser C++ execution strategy.
- `content/PRODUCT_SPEC.md`: high-level product intent/spec.
- `content/PHASE_0_FULL_SPEC.md`: detailed phase-specific spec.

#### Data content

- `data/chapters/dsa_ch_001_intro.json`: chapter seed content for DSA intro.
- `data/chapters/dsa_ch_002_time_complexity.json`: chapter seed content for time complexity.
- `data/chapters/dsa_ch_003_arrays.json`: chapter seed content for arrays.

---

## How The Main Apprenticeship Flow Works

1. Public catalog fetches active programs from `/api/v1/apprenticeship/programs`.
2. Program detail page loads program + projects and can initiate Razorpay order creation.
3. Enrollment is completed through `/api/v1/apprenticeship/enroll`.
4. Student dashboard/enrollment screens read enrollment and project progress tables.
5. Student opens a project workspace.
6. Workspace checks GitHub connection; if absent, user starts OAuth.
7. Backend stores encrypted GitHub token and later provisions a private repo from a template.
8. User clones repo, codes locally, pushes to `main`.
9. GitHub webhook creates an `apprenticeship_submissions` row and enqueues verification.
10. Worker clones the exact commit, runs Docker tests, stores staged results, and broadcasts updates.
11. Workspace subscribes to submission updates and refreshes tests/status.
12. If pass conditions are met, project progress is advanced, next project can unlock, XP is awarded, and a certificate may be issued at program completion.

---

## What Is Strong vs. What Needs Attention

### Strong areas

- Apprenticeship domain separation is good.
- API surface is broad and mostly organized by route/controller/service layers.
- Admin console covers most back-office needs.
- Verification pipeline is concrete and production-oriented.
- React Query adoption is consistent.
- File naming is readable and business-oriented.

### Weak or fragile areas

- Root README/admin README are template leftovers and do not describe the actual product.
- Student DSA learning flow mixes live API-backed pieces with local mock data.
- Some pages are very large and contain both orchestration and presentation.
- Route/controller/service coverage is wide, but there is limited visible test depth.
- Import drift is likely in at least one backend route (`requireRole` in resume route).
- Worker startup is implicit through imports rather than explicit process separation.

---

## Recommended Next Documentation Steps

1. Replace root `README.md` with actual architecture/setup/runtime instructions.
2. Split the DSA learner flow into clear API-backed vs. mock-only sections.
3. Add sequence diagrams for:
   - auth bootstrap
   - apprenticeship checkout and enrollment
   - GitHub verification lifecycle
4. Document required environment variables per app, not just examples.
5. Add a route-to-page and endpoint-to-service map as living docs.
6. Add test coverage around:
   - auth middleware
   - apprenticeship enrollment
   - GitHub webhook verification
   - verification worker pass/fail cascade

---

## Fast Orientation Guide For New Developers Or AI Agents

If you need to understand the repo quickly, open files in this order:

1. `docs/PROJECT_AUDIT.md`
2. `src/App.tsx`
3. `admin/src/App.tsx`
4. `backend/src/routes/index.ts`
5. `backend/src/modules/apprenticeship/routes.ts`
6. `backend/src/modules/apprenticeship/programs.service.ts`
7. `backend/src/modules/github/github.controller.ts`
8. `backend/src/workers/verification.worker.ts`
9. `src/pages/WorkspacePage.tsx`
10. `admin/src/pages/apprenticeship/ProjectEditorPage.tsx`

If the task is DSA learning flow:

- start in `src/pages/*`, `src/data/chapters.ts`, `backend/src/routes/chapters.ts`, `backend/src/services/chapters.service.ts`

If the task is admin/content:

- start in `admin/src/pages/*`, `admin/src/services/*`, `backend/src/routes/admin.ts`, `backend/src/controllers/admin.controller.ts`, `backend/src/services/admin.service.ts`

If the task is apprenticeship:

- start in `src/pages/Apprenticeship*`, `src/pages/WorkspacePage.tsx`, `admin/src/pages/apprenticeship/*`, `backend/src/modules/apprenticeship/*`, `backend/src/modules/github/*`, `backend/src/workers/verification.worker.ts`

