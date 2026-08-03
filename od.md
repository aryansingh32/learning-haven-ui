# 🔍 DSA OS — Comprehensive Codebase Audit Report
**Principal Engineer Grade | MNC Standard | June 2026**

> Audited 839 files across `apps/web` (React/TS), `apps/api` (Express/TS), `apps/admin` (React/TS), 17 Supabase migrations, and all config/doc files.

---

## Executive Summary

Your stack is genuinely impressive — Turborepo monorepo, Supabase real-time, Razorpay payments, Docker test runners, GitHub webhook pipelines, entitlement middleware. The **architecture is sound**. The crisis is entirely in **glue code, user flow, and data persistence**. Users are lost not because the product is bad — they're lost because critical paths are broken at the seams where features connect.

**Three headline blockers:**
1. **Onboarding answers never reach the database.** Career track, goals, study time — all saved to `localStorage` only. The "personalized roadmap" is theater.
2. **The Challenges (Build Haven) system works but is invisible.** The git-push → Docker verification pipeline is real and functional. Users just don't know they need to do it because the "setup" tab is hidden and logs default to collapsed.
3. **The Learn page has no career layer.** Courses exist, chapters work, but there's no "you chose Backend Developer → start here" guidance post-onboarding.

---

## Section 1: Architecture & Integration Map

### 1.1 Monorepo Structure
```
learning-haven-ui/
├── apps/
│   ├── web/          ← React 18, Vite, TailwindCSS, react-query
│   ├── api/          ← Express, Supabase, Razorpay, BullMQ workers
│   └── admin/        ← Separate React app, full CMS
├── packages/
│   ├── contracts/    ← Shared TypeScript types (auth only — 90% empty)
│   ├── types/        ← Empty placeholder
│   ├── config/       ← Empty placeholder
│   └── ui/           ← Empty placeholder
```

### 1.2 The Integration Silo Map (Where Things Break)

| Feature | Frontend Page | Backend Route | DB Table | Integration Status |
|---|---|---|---|---|
| Onboarding answers | `Onboarding.tsx` | ❌ **NONE** | ❌ `users` has no `career_track` column | **🔴 BROKEN** — goes to localStorage |
| Learn/Courses | `CoursesCatalogPage` → `ChaptersOverviewPage` → `LearnChapterPage` | `/api/courses`, `/api/chapters` | `phases`, `chapters`, `chapter_progress` | 🟡 Works but 4 levels deep, no career context |
| Build Challenges | `ProjectsPage` → `BuildChallengePage` → `BuildWorkspacePage` | `/api/v1/build/*` | `apprenticeship_programs`, `build_stages`, `build_enrollments`, `build_attempts` | 🟡 Pipeline works, UX is broken |
| Monetization | `Pricing.tsx` → Razorpay | `/api/v2/payments/*` | `plans`, `subscriptions`, `payments` | 🟡 Payment works, no in-app paywall triggers |
| Career/Roadmap | `RoadmapContext.tsx` | ❌ **No dedicated endpoint** | ❌ No `user_career_preferences` table | **🔴 BROKEN** — context derives from existing data |
| Admin → App | `apps/admin/*` | `/api/admin/*` | All tables | 🟡 Connected, but catalog changes have ~5min cache lag |

### 1.3 Route Inventory (All Routes)

**Public:**
- `/` — LandingPage (good entry, missing social proof numbers)
- `/landing` — redundant duplicate of `/`
- `/pricing` — standalone, no app shell
- `/signin`, `/signup` — email-only, no OAuth

**Protected (AppLayout wraps all):**
- `/dashboard` — Index.tsx (gamification dashboard — empty for new users)
- `/courses` — CoursesCatalogPage
- `/course/:id/chapters` — ChaptersOverviewPage
- `/chapter/:id` — LearnChapterPage
- `/topics` — TopicsPage (problem list, separate from courses)
- `/projects` — ProjectsPage (challenge catalog)
- `/projects/:slug` — BuildChallengePage (challenge detail + enroll)
- `/projects/:slug/workspace` — BuildWorkspacePage (full IDE-like experience)
- `/ai-coach` — AICoachPage
- `/jobs` — JobsPage
- `/resume` — ResumePage
- `/referrals` — ReferralsPage
- `/certificates` — CertificatesPage
- `/profile` — ProfilePage
- `/subscription` — SubscriptionPage

**Navigation labels (AppLayout sidebar):**
- "Mission Control" → `/dashboard` ← confusing name
- "Learn" → `/courses`
- "Challenges" → `/projects`
- "Mentor" → `/ai-coach`
- "Achievements" → `/profile`

---

## Section 2: Critical Bug Register

### BUG-001 🔴 SEVERITY: CRITICAL — Onboarding Data Lost on Every Session

**File:** `apps/web/src/pages/Onboarding.tsx`, line 165

**What happens:** User completes 5-step onboarding (level, career track, goal, time, reminders). All answers go to `localStorage` under key `dsa_os_onboarding`. **Not a single API call is made.**

**Impact:** 
- Career track selection (backend/frontend/fullstack/FAANG) is never stored in DB
- `RoadmapContext.tsx` tries to build a roadmap from this data but it vanishes on browser clear, incognito, new device, or logout
- The "personalized roadmap" shown post-onboarding is 100% local — every user gets the same experience regardless of answers

**The DB confirms this:** `public.users` table has: `id`, `email`, `full_name`, `avatar_url`, `phone`, `current_plan`, `plan_expires_at`, `xp`, `level`, `streak`, `referral_code` — **no `career_track`, `learning_goal`, `daily_time`, or `onboarding_completed` columns.**

**Fix Checklist:**
- [x] Add `ALTER TABLE users ADD COLUMN career_track TEXT`, `learning_goal TEXT`, `daily_time_minutes INTEGER`, `onboarding_completed BOOLEAN DEFAULT FALSE`
- [x] Add `PATCH /api/users/me/profile` endpoint in `apps/api/src/modules/auth/routes/users.ts`
- [x] In `Onboarding.tsx`, replace `localStorage.setItem(...)` with `api.patch('/users/me/profile', { career_track, learning_goal, daily_time_minutes, onboarding_completed: true })`
- [x] Redirect to `/dashboard?first_time=true` on success, not bare `/dashboard`
- [x] In `AuthContext.tsx`, check `user.onboarding_completed` — redirect to `/onboarding` if false (currently there's no such guard)

---

### BUG-002 🔴 SEVERITY: CRITICAL — Build Workspace Logs Default to Hidden

**File:** `apps/web/src/pages/BuildWorkspacePage.tsx`, line 62

```typescript
const [showLogsOpen, setShowLogsOpen] = useState(false); // ← THE BUG
```

**What happens:** User pushes code to GitHub. The webhook fires, Docker spins up, tests run, results come back via Supabase realtime. The `liveLogLines` array fills with beautiful diff-colored output. But `showLogsOpen` is `false` so the user sees… nothing. Just a spinner that eventually resolves to "passed" or "failed" with no explanation.

**Fix Checklist:**
- [x] Change default: `useState(true)` — logs should always be visible in workspace
- [x] Auto-scroll logs to bottom as new lines arrive (add `useEffect` with `scrollIntoView` on the log container ref)
- [x] Show a "Waiting for your push..." message with the git command when `isVerifying` is false and no attempts exist yet
- [x] Pin the test runner panel at the bottom — don't let users scroll past it

---

### BUG-003 🟠 SEVERITY: HIGH — Build Workspace Default View is Stage 1, Not Setup

**File:** `apps/web/src/pages/BuildWorkspacePage.tsx`, line 48–51

```typescript
const activeView: ViewMode = viewMode ?? enrollment?.current_stage ?? stagesSorted[0]?.stage_number ?? 'setup';
```

**What happens:** If a user has an enrollment, `viewMode` defaults to `enrollment.current_stage` (stage 1), skipping the `'setup'` view entirely. New users who haven't connected GitHub or cloned the repo land directly on stage instructions with no context.

**Fix Checklist:**
- [x] If `enrollment.repo_full_name` is null, force `activeView = 'setup'` regardless of enrollment state
- [x] Add a "Setup Required" banner at the top of stage views if GitHub is not connected
- [x] On the `BuildChallengePage` (before enrollment), add a 3-step visual explainer: "1. Connect GitHub → 2. Clone repo → 3. Push code" with icons. This sets expectations before they click "Start Challenge"

---

### BUG-004 🟠 SEVERITY: HIGH — Learn Page Has No Career Context

**Files:** `apps/web/src/pages/CoursesCatalogPage.tsx`, `RoadmapContext.tsx`

**What happens:** After onboarding where user picks "Backend Developer," they navigate to `/courses` and see a generic course catalog. There's no "Recommended for Backend Developers" section, no "Start here" guidance, no connection between their stated goal and the content shown.

**Fix Checklist:**
- [ ] After persisting career_track to DB (BUG-001 fix), load it in `CoursesCatalogPage` from user profile
- [ ] Add a "Your Path" card at the top of `/courses` showing: career track badge, recommended first course, estimated timeline
- [ ] Add `?recommended=true` query filter to course list — backend should prioritize courses tagged with the user's career track
- [ ] Show "Start Here →" button pointing to the chapter that matches their `level` answer from onboarding

---

### BUG-005 🟡 SEVERITY: MEDIUM — Duplicate Landing Routes

**File:** `apps/web/src/App.tsx`, lines 62–64

```tsx
<Route path="/landing" element={<LandingPage />} />  // inside AuthLayout
<Route path="/" element={<LandingPage />} />          // outside AuthLayout
```

The `/landing` route is inside `AuthLayout` (which adds a different shell) while `/` is a standalone route. They render the same component but with different wrapper behavior.

**Fix Checklist:**
- [ ] Remove `/landing` route — make `/` the single source of truth for landing
- [ ] Ensure `useEffect` in `LandingPage.tsx` redirects authenticated users to `/dashboard`
- [ ] Update all internal links that point to `/landing`

---

### BUG-006 🟡 SEVERITY: MEDIUM — Auth Has No Social Login

**Files:** `apps/web/src/pages/auth/SignIn.tsx`, `apps/web/src/pages/auth/SignUp.tsx`

Both forms are email+password only. SignUp has 4 fields including referral code which adds friction.

**Fix Checklist:**
- [x] Add Google OAuth via Supabase (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
- [x] Add GitHub OAuth (you already have GitHub OAuth infrastructure for build challenges — reuse it)
- [x] Move referral code to a collapsible "Have a referral code?" link — don't show by default
- [x] Remove the "Full Name" field from signup — collect it in onboarding step 0 instead
- [x] Add "Forgot password?" link to SignIn (currently missing entirely)

---

### BUG-007 🟡 SEVERITY: MEDIUM — Dashboard Empty State for New Users

**File:** `apps/web/src/pages/Index.tsx`

**What happens:** New users land on the dashboard. XP = 0, streak = 0, no heatmap data, mission shows null. The `StatCard` components render "0" everywhere. The `ActivityCalendar` shows all grey. No guidance on what to do.

**Fix Checklist:**
- [x] Detect first-time users via `?first_time=true` query param (from BUG-001 fix) or `profileStats?.total_solved === 0`
- [x] Show a full-width "Welcome Banner" for new users: "You're ready to start, [Name]! Your first mission is waiting →"
- [x] Replace empty stat cards with a "Getting Started" checklist widget (3 items: complete first chapter, solve first problem, join a challenge)
- [x] Hide the Activity Calendar entirely if there are 0 data points — show "Start your streak today!" instead

---

### BUG-008 🟡 SEVERITY: MEDIUM — Navigation Labels Don't Match Mental Models

**File:** `apps/web/src/components/AppLayout.tsx`, lines 19–26

```typescript
const primaryNav = [
  { to: "/dashboard", label: "Mission Control" },  // ← nobody knows this means home
  { to: "/courses", label: "Learn" },
  { to: "/projects", label: "Challenges" },
  { to: "/ai-coach", label: "Mentor" },
  { to: "/profile", label: "Achievements" },        // ← profile ≠ achievements
];
```

**Fix Checklist:**
- [ ] Rename "Mission Control" → "Dashboard" or "Home"
- [ ] Rename "Achievements" → "Profile" (the route is `/profile`, the page shows profile content)
- [ ] Add `/topics` to navigation as "Practice" (it's currently unreachable from sidebar)
- [ ] Add subtle XP/level display next to user avatar in sidebar header

---

### BUG-009 🟡 SEVERITY: MEDIUM — `packages/` Are All Empty

**Files:** `packages/types/`, `packages/config/`, `packages/ui/`

The `pnpm-workspace.yaml` declares these packages but they're hollow — no source files, just `package.json`. The `packages/contracts/src/` only has a skeleton auth index. This means frontend and backend share zero type contracts — the same interfaces are defined independently in both.

**Fix Checklist:**
- [ ] Move shared types to `packages/contracts/src/`: `BuildChallenge`, `BuildEnrollment`, `Plan`, `Entitlement`, `User`
- [ ] Import from `@dsaos/contracts` in both `apps/web` and `apps/api`
- [ ] Add `packages/ui/` with shared `Button`, `Badge`, `Card` — currently admin and web duplicate Shadcn setups

---

## Section 3: The Learn Page — Career System & Course UX

### 3.1 Current State
The learn path is: `/courses` → `/course/:id/chapters` → `/chapter/:id` — three page transitions before seeing any content. The course catalog loads from `fetchPhases()` which calls `/api/courses` correctly, but:

- No career-track filtering
- No "where to start" guidance
- No progress visible from catalog view (only inside ChaptersOverviewPage)
- The `ChaptersOverviewPage` has a beautiful mission-style layout but you can only reach it by clicking into a specific course

### 3.2 Task Checklist — Learn Page Career System

- [ ] **Add `career_track` column to users table** (see BUG-001) and use it to filter/sort courses
- [ ] **Create a "Your Learning Path" section** at the top of `/courses` that shows:
  - Career track badge ("Backend Developer")
  - Current week in the roadmap ("Week 3 of 12")
  - Next recommended chapter with a "Continue" button
  - Estimated time to completion
- [ ] **Add course progress rings** to each course card in the catalog (call `/api/courses/:id/progress` or derive from chapter completion data)
- [ ] **Reduce navigation depth**: Consider merging `ChaptersOverviewPage` into `CoursesCatalogPage` as an expandable accordion — saves one page transition
- [ ] **Add a "Recommended Start" chip** to courses that match the user's career track (e.g., "Perfect for Backend Developer")
- [ ] **Add a `/roadmap` page** (new page) showing the full week-by-week plan, powered by `RoadmapContext`. This is the "career system" users expected from onboarding
- [ ] **Backend**: Add `GET /api/users/me/roadmap` endpoint that returns personalized week plan based on stored `career_track` and `level`
- [ ] **Backend**: Add `GET /api/courses/:id/progress` for user's chapter completion percentage per course

### 3.3 Courses UI Improvements

- [ ] Replace the placeholder partner logos in `PartnerMarquee` with real ones or remove the section
- [ ] Add estimated total duration to each course card ("~8 hours total")
- [ ] Add difficulty level badge to course cards
- [ ] Make the HeroCarousel's slides link to actual courses, not just `/courses`
- [ ] The `CareerExplorer` section at the bottom of CoursesCatalogPage renders from CMS data — ensure admins have populated it (currently shows DEFAULT_CAREERS fallback)

---

## Section 4: Build / Challenges System (CodeCrafters Flow)

### 4.1 What Works ✅
The infrastructure is genuinely excellent:
- GitHub OAuth → private repo creation
- Git push webhook → BullMQ worker queue
- Docker test runner with timeout enforcement
- Supabase realtime broadcast for live logs
- Stage pass/fail detection with structured feedback
- Leaderboard per challenge per language

### 4.2 What's Broken ❌

**User Journey Today (broken):**
1. User sees `/projects` catalog — cards look good
2. Clicks a challenge → `BuildChallengePage` — reads description, sees stages listed
3. Clicks "Start Challenge" → enrollment created, redirected to `/workspace`
4. **Lands on Stage 1 instructions** with no context that they need to connect GitHub, clone code, and push
5. Reads instructions, tries to implement in... where? There's no in-browser editor
6. User is confused — where do they write code? What do they push? Which branch?
7. Eventually notices "Setup" tab in sidebar — connects GitHub
8. Gets clone URL, clones locally, implements, pushes
9. Nothing visible happens — logs are hidden (BUG-002)
10. Refreshes page, finally sees "passed" badge

**User Journey Goal (fixed):**
1. `/projects` catalog → clear "CodeCrafters-style" callout explaining the git workflow
2. Click challenge → hero section explains: "Write locally → Push to GitHub → We verify instantly"
3. Click "Start Challenge" → forced to Setup view first (BUG-003 fix)
4. Clear step-by-step: ① Connect GitHub ② Clone repo ③ Code locally ④ Push to verify
5. Push code → logs immediately visible and auto-scrolling
6. Test passes → celebration + "Move to Stage 2" prompt

### 4.3 Task Checklist — Build Haven System

- [ ] **Fix BUG-002**: Default logs to open (`useState(true)`)
- [ ] **Fix BUG-003**: Force `setup` view if `enrollment.repo_full_name` is null
- [ ] **Add "How it works" section** to `BuildChallengePage` (before the user enrolls): a 3-step visual with icons showing the git-push → verify flow
- [ ] **Add `BuildWorkspaceTopBar` status indicator**: Show current stage `N of M`, GitHub connection status, and last push time
- [ ] **Add a "Push & Verify" reminder banner** on the stage instruction pane: "Made progress? `git push origin main` to run tests"
- [ ] **Auto-expand logs** whenever `isVerifying` becomes true (useEffect watching `isVerifying`)
- [ ] **Add "Copy push command" button** at the top of every stage view — not just in Setup
- [ ] **Admin action needed**: Seed at least 3 build challenges via `scripts/seed-catalog-layout.ts` so the catalog isn't empty for real users
- [ ] **Show attempt history per stage**: List of past attempts with timestamps and pass/fail status — users want to know what changed between attempts
- [ ] **Add "Previous Attempts" count badge** to each stage in the sidebar — e.g., "Stage 2 (3 attempts)"
- [ ] **Progress persistence**: `BuildWorkspacePage` calls `workspaceQuery.refetchInterval: 8000` — consider switching to pure realtime via Supabase subscription and removing polling

---

## Section 5: Admin Panel Integration

### 5.1 Admin Panel Status
The admin panel (`apps/admin/`) is comprehensive and well-built:
- Full CMS for courses, chapters, problems, categories
- Build Haven challenge management (create/edit stages, languages, enrollments)
- Plans management (prices, features, entitlements)
- Gamification settings
- User management with role controls

### 5.2 Critical Admin Gaps

**Admin → App Data Pipeline:**

| Admin Action | Data Flow | Issue |
|---|---|---|
| Admin creates a Build Challenge | `POST /api/v1/build/admin/challenges` → DB | Challenge shows in `/projects` only after `is_active: true` and `status: live` |
| Admin sets challenge stages | `POST /api/v1/build/admin/challenges/:id/stages` → DB | Stages work once GitHub webhook is configured |
| Admin publishes a course | `POST /api/admin/courses` → DB | Appears in `/courses` immediately (no cache issue) |
| Admin edits plan pricing | `PUT /api/admin/plans` → DB | Plans cache expires in 5 min (`plans.ts:_cacheExpiry`) — OK |

### 5.3 Task Checklist — Admin Gaps

- [ ] **GitHub Webhook Configuration**: Admins need a UI field for `webhook_url` per challenge (currently hardcoded from env). Add this to `BuildChallengeEditorPage` in admin
- [ ] **Docker image per stage**: The `docker_test_image` column exists but admin UI may not expose it — verify admin stage editor shows this field
- [ ] **Starter template URLs**: Each challenge language needs a `starter_repo_url`. Add validation to the admin language editor that this field is set before marking a challenge as `live`
- [ ] **Challenge "Preview as User" button**: Add a link in admin challenge view to open the user-facing page in a new tab
- [x] **Seed required data before launch**:
  - [x] Run `scripts/seed-plans.ts` to populate `plans` table
  - [x] Run `scripts/seed-roadmaps.ts` to populate roadmap data
  - [x] Run `scripts/seed-chapters.ts` for chapter content
  - [x] Create at least 3 build challenges with complete stages via admin panel

---

## Section 6: PLG Conversion Funnel & Psychological Flow Deep-Dive

### 6A. The Initial Landing-to-Auth Hook

#### What's Missing Above the Fold

The landing page (`LandingPage.tsx`) has solid pain-point framing ("Sound familiar?") but is missing two conversion-critical elements:

1. **Social proof numbers are hardcoded fakes**: TopicsPage shows "10,000+ students" but this is a hardcoded string in JSX. The landing page shows nothing. Use real DB counts from `SELECT COUNT(*) FROM users` via a public endpoint.
2. **No outcome proof**: After the pain points, users need to see "Here's what students who used DSA OS achieved" — AMCAT scores, job offers, company names. The landing has a "Journey visual" (phases 1-3) but no student outcomes.
3. **No urgency / scarcity**: No "X students enrolled this week" or "Cohort closes in Y days"

#### Auth Friction Audit

| Element | Current State | Issue |
|---|---|---|
| Sign In fields | Email + Password | Missing "Forgot password?" link |
| Sign In social | None | No Google/GitHub OAuth |
| Sign Up fields | Name + Email + Password + Referral | 4 fields = friction |
| Sign Up social | None | No Google/GitHub OAuth |
| Post-signup redirect | `/onboarding` | ✅ Correct |
| Post-signin redirect | `/dashboard` | ✅ Correct |
| Auth page chrome | `AuthLayout` wrapper | Adds sidebar chrome to auth — should be clean, full-screen |

#### Task Checklist — Auth Entry

- [x] Add Google OAuth button (top of both forms, "Continue with Google" — not buried)
- [x] Add GitHub OAuth button (especially valuable for devs doing Build challenges)
- [x] Remove Name field from SignUp — get it in onboarding step 0 (saves one friction point)
- [x] Move referral code to collapsible "Have a referral code?" link
- [x] Add "Forgot password?" link to SignIn
- [x] `AuthLayout` should be full-screen, no sidebar chrome for auth pages
- [x] Add "No credit card required. Free forever" microcopy below the Sign Up CTA on landing
- [x] On landing, show "→ See how it works in 60 seconds" as a secondary CTA (links to a demo video or interactive tour)

---

### 6B. Time-to-Value (TTV) & The "Aha!" Moment

#### Why Users Lose Momentum After Login

The sequence: Signup → Onboarding → Dashboard shows empty stats. There is no prompt telling the user what to do next. The sidebar has 5 items — "Mission Control, Learn, Challenges, Mentor, Achievements" — with no visual hierarchy to indicate which to click first.

**The Aha Moment for DSA OS should be:** "I solved my first problem and it was easier than I expected" — this needs to happen within the first 5 minutes.

**Current path to first solve:** `/courses` → click a course → `/course/:id/chapters` → click chapter → `/chapter/:id` → scroll through story hook + video + quiz + task → mark complete. That's 3 page loads and 20+ minutes minimum.

#### Task Checklist — Shortening TTV

- [ ] **Add a "First Mission" forced flow for new users**: After onboarding, redirect to `/chapter/{first-free-chapter-id}` directly — skip the catalog entirely on day 1
- [ ] **Add a progress checklist widget** to the dashboard for users with 0 completions:
  ```
  ✅ Created your account
  ☐ Complete your first chapter  → [Start Chapter 1]
  ☐ Solve your first problem     → [Browse Problems]  
  ☐ Start a build challenge      → [View Challenges]
  ```
- [ ] **Add contextual empty states** to each section:
  - Dashboard with 0 solves → "Solve your first problem to see your stats come alive"
  - `/topics` with 0 progress → "Pick a topic to start — Arrays is the best place to begin"
  - `/projects` with no challenges → "Master the basics in Learn first, then come back here"
- [ ] **Add a "Quick Start" banner** that appears for users where `onboarding_completed = true AND total_solved = 0`, shown on dashboard: "Your journey starts with Chapter 1 of DSA Foundations. Takes 15 minutes."
- [ ] **Speed up the first problem**: Ensure Chapter 1 has at least one interactive problem (not just video + quiz). First tactile success = aha moment.
- [ ] **Dismissible onboarding hotspot**: Show a pulsing dot on the "Learn" nav item for new users with tooltip "Start here → Chapter 1 is unlocked for free"

---

### 6C. Microinteractions & Visual Hierarchy

#### Dead UI Areas

| Area | Current State | Fix |
|---|---|---|
| Build workspace log panel | Static terminal-style div, no scroll animation | Add `smooth scroll to bottom` on new log lines |
| Challenge "Start" button | Basic button, no state | Add loading state + "Setting up your repo…" text during enrollment |
| Chapter step completion | Clicking "Complete" triggers mutation, page reloads data | Add an instant ✅ checkmark animation before refetch |
| Pricing plan select | Cards with highlight, clicking triggers Razorpay modal | Add a "Selected" glow state + brief scale animation on click |
| Dashboard XP counter | Static number | Animate XP increases with a "+150 XP" flyup text |
| Stage pass modal | Exists (`StagePassModal.tsx`), triggers confetti | ✅ Good — ensure it actually triggers on every first-pass |
| Sidebar nav active state | `motion.div` with `layoutId="sidebar-active"` | ✅ Good — keep this |

#### Visual Hierarchy Fixes

The "Happy Path" (what we want users to do next) must dominate. Current issue: all nav items are equal weight.

- [ ] **Highlight the recommended action** on the dashboard with an `orange-gradient` CTA, not a neutral card
- [ ] **Add skeleton loaders** everywhere data is fetching (some pages already have them — standardize)
- [ ] **Add button active states**: All `<Button>` components should have `active:scale-95` transition
- [ ] **Add input validation feedback**: SignUp/SignIn forms have no real-time validation — add green checkmark on valid email, red border on invalid
- [ ] **Build workspace**: Show a persistent "Push to verify" chip at the top when the user is on a stage they haven't passed yet
- [ ] **Course cards**: Add a progress bar at the bottom of each card showing % complete if the user has started the course
- [ ] **Challenge cards**: Add a "completed stages" progress bar (e.g., "3/7 stages") if enrolled
- [ ] **Add loading shimmer to all skeleton components** (replace grey blocks with animated gradient)

#### Task Checklist — Microinteractions

- [ ] Standardize skeleton loaders across all pages using the Shadcn `Skeleton` component
- [ ] Add `active:scale-95` to all interactive buttons via Tailwind config
- [ ] Add `transition-all duration-200` to all card hover states
- [ ] Auto-scroll log panel to bottom when new lines arrive
- [ ] Add real-time form validation to SignUp (email format, password length)
- [ ] Add "+XP" flyup animation when XP increases on dashboard
- [ ] Add a "Saved!" toast when users save notes
- [ ] Add progress bar animation when chapter completion percentage changes

---

### 6D. The Psychological Paywall Engine

#### Current Monetization State

Plans exist in DB (`free`, `path_pack`, `pro`, `career_accelerator`). Entitlement middleware (`requireEntitlement`) gates:
- Build challenges: `challenge_limit` (free = 3, paid = unlimited)
- AI queries: `ai_queries_per_day` (free = 5, path_pack = 20, pro = unlimited)
- Career paths access, certificates, resume builder

**The problem:** None of this is surfaced in the UI. There are zero "premium lock" indicators anywhere in `apps/web/`. Users hit a 403 error from the API and see a generic toast. No upgrade prompt, no value framing.

#### Natural "Value Walls" to Build

| Trigger | When It Fires | Psychological Lever |
|---|---|---|
| 4th build challenge | User tries to start 4th challenge (free limit = 3) | Loss aversion: "You've completed 3 challenges. Unlock unlimited with Pro." |
| 6th AI query today | User sends 6th AI query (free = 5/day) | Scarcity: "5/5 AI queries used today. Reset at midnight or upgrade for unlimited." |
| Clicking a locked course | Course requires `path_pack` or higher | Social proof: "2,340 students are on this path — join them" |
| Certificate page | Certificate requires paid plan | Aspiration: "Your certificate is waiting — upgrade to claim it" |
| Resume builder | Requires Pro | Career FOMO: "Recruiters at Flipkart, Razorpay use this format" |

#### Paywall Component Layout (Psychological Order)

For the upgrade modal/page, display in this order:
1. **What they're missing** (specific, not generic) — "You've built 3 systems. Pro users build 20+ and add them to their portfolios."
2. **Social proof** — "Join 1,200 students who upgraded and landed jobs at [logos]"
3. **Loss framing** — "Your current streak and XP carry over. Don't lose your progress streak by stopping now."
4. **The price anchor** — Show annual first with monthly crossed out. ~~₹799/mo~~ → ₹583/mo billed annually
5. **Risk reversal** — "7-day money-back guarantee. No questions asked."
6. **Single CTA** — "Upgrade to Pro" (not "Choose a plan" — direct action language)

#### Task Checklist — Psychological Monetization Loops

- [ ] **Create `<PremiumLockBadge />` component**: A small `Crown` icon + "Pro" label. Add it to locked course cards, locked features in sidebar, and locked chapters in ChaptersOverviewPage
- [ ] **Create `<UsageMeter />` component**: Shows `5/5 AI queries used · Resets in 3h` — place in AICoachPage header
- [ ] **Create `<UpgradePrompt />` modal**: Triggered when user hits any entitlement wall. Passes the `feature_key` to show context-specific copy ("You've reached your challenge limit" vs "AI queries used for today")
- [ ] **Wire entitlement errors to `<UpgradePrompt />`**: Currently API returns 403 with `{ upgradeRequired: true }` — catch this in the global error handler and show the modal instead of a toast
- [ ] **Add upgrade CTA to dashboard** for free users: A persistent (but dismissible) banner: "🔓 Unlock unlimited challenges + AI coaching · ₹583/mo"
- [ ] **Add "Pro" badge to AI Coach page** for free users with a usage counter
- [ ] **Add subtle upgrade trigger to challenge workspace**: When free user completes their 2nd challenge (out of 3), show a banner: "You're on a roll! 1 free challenge left. Upgrade for unlimited."
- [ ] **Annual toggle default**: Set `isAnnual = true` as the default on the Pricing page (it already is — keep this)
- [ ] **Add coupon field to the UpgradePrompt modal** (not just the full pricing page) — referral discounts apply here

---

## Section 7: Database Schema Gaps

| Gap | Impact | Fix |
|---|---|---|
| `users` table missing `career_track`, `learning_goal`, `onboarding_completed` | Entire personalization engine broken | `ALTER TABLE users ADD COLUMN ...` |
| `build_enrollments` missing `celebrated_stages` column | `BuildWorkspacePage.tsx` reads `enrollment.celebrated_stages` but column may not exist | Check migration 20260520000001 — add if missing |
| No `user_career_preferences` table | Career system has nowhere to store multi-preference data | Create table with `user_id`, `career_track`, `target_companies`, `target_salary`, `created_at` |
| `plans` table uses new schema (from migration 20260606100001) but `users.current_plan` still uses old string format ('basic-monthly') | Plan check inconsistency | Update `current_plan` column to reference `plans.slug` enum |

---

## Section 8: Backend Code Quality

### 8.1 What's Good
- Request tracing middleware with correlation IDs ✅
- Prometheus metrics endpoint ✅
- Helmet + CORS + compression ✅
- BullMQ workers for async jobs ✅
- Idempotency key middleware on write routes ✅
- Rate limiting on write and webhook routes ✅
- Global error handler that hides stack traces in production ✅
- Test suite exists (`__tests__/`) ✅

### 8.2 Issues

**Dual payment system:** Both `billing/routes/payments.ts` and `billing/routes/payments.v2.ts` are mounted. The V2 uses `plan_id` + `billing_cycle`, V1 uses old plan string IDs. Frontend uses V2 but old routes are still live and could receive requests.

- [ ] Deprecate `payments.ts` (V1) — add a middleware that returns `410 Gone` with "Use /v2/payments"
- [ ] Deprecate `subscriptions.ts` and `referrals.ts` — replace with `referrals.v2`

**Missing PATCH /api/users/me/profile endpoint** — needed for onboarding fix (see BUG-001)

**`email.worker.ts` is 11 bytes:** `import './email.worker'` is imported in `app.ts` but the file is essentially empty. Email notifications are not functional.
- [ ] Implement email worker using the existing `EmailService` in `communication/services/email.service.ts`

---

## Section 9: Frontend Technical Debt

| Issue | File | Fix |
|---|---|---|
| `any` types throughout | `BuildWorkspacePage.tsx` — `challenge: any`, `enrollment: any` | Create proper TypeScript interfaces in `packages/contracts` |
| Missing error boundaries | No `ErrorBoundary` wrapper around page components | Add React Error Boundary at `AppLayout` level |
| No 404 handling for API errors | `useApiQuery` returns undefined on 404 — pages render blank | Add `onError` callback that shows error state UI |
| `cursor_build_haven_platform_requirement.md` in repo root | `apps/web/` | Remove AI prompt files from production codebase |
| `replace_frontend.js` in repo root | `apps/web/` | Remove development utility scripts from production |

---

## Section 10: Priority Action Plan

### 🔴 Do This Week (Blockers)

1. **BUG-001**: Persist onboarding to DB (2 hours) — migration + endpoint + frontend
2. **BUG-002**: Default logs to open in workspace (5 minutes) — one line change
3. **BUG-003**: Force setup view if no repo connected (1 hour)
4. **Seed content**: Run all seed scripts, create 3 build challenges in admin panel (2 hours)

### 🟠 Do Next Sprint (High Impact)

5. Add Google OAuth to auth pages (3 hours)
6. Add `<PremiumLockBadge />` and `<UpgradePrompt />` components (4 hours)
7. Build the "First Mission" forced flow for new users (4 hours)
8. Add "How it works" section to BuildChallengePage before enrollment (2 hours)
9. Add career context to CoursesCatalogPage (3 hours)

### 🟡 Backlog (Polish)

10. Deprecate V1 payment routes
11. Fill `packages/contracts` with shared types
12. Add breadcrumb navigation to all nested pages
13. Implement email worker
14. Add `/roadmap` page powered by RoadmapContext

---

## Appendix: File Reference Index

| Component | Path | Status |
|---|---|---|
| App router | `apps/web/src/App.tsx` | ✅ Well structured |
| AuthContext | `apps/web/src/context/AuthContext.tsx` | 🟡 Missing onboarding guard |
| RoadmapContext | `apps/web/src/context/RoadmapContext.tsx` | 🔴 No backend, pure derivation |
| AppLayout/Sidebar | `apps/web/src/components/AppLayout.tsx` | 🟡 Label issues |
| Landing | `apps/web/src/pages/LandingPage.tsx` | 🟡 Missing social proof |
| SignIn | `apps/web/src/pages/auth/SignIn.tsx` | 🟠 No OAuth |
| SignUp | `apps/web/src/pages/auth/SignUp.tsx` | 🟠 No OAuth, too many fields |
| Onboarding | `apps/web/src/pages/Onboarding.tsx` | 🔴 localStorage only |
| Dashboard | `apps/web/src/pages/Index.tsx` | 🟠 No empty state |
| CoursesCatalog | `apps/web/src/pages/CoursesCatalogPage.tsx` | 🟡 No career context |
| ProjectsPage | `apps/web/src/pages/ProjectsPage.tsx` | 🟡 No flow explainer |
| BuildChallengePage | `apps/web/src/pages/BuildChallengePage.tsx` | 🟠 No git workflow explainer |
| BuildWorkspacePage | `apps/web/src/pages/BuildWorkspacePage.tsx` | 🔴 Logs hidden, wrong default view |
| Pricing | `apps/web/src/pages/Pricing.tsx` | ✅ Well built, Razorpay integrated |
| Backend app | `apps/api/src/app.ts` | ✅ Solid production config |
| Plans service | `apps/api/src/utils/plans.ts` | ✅ DB-driven with fallback |
| Build Haven routes | `apps/api/src/modules/build-haven/routes.ts` | ✅ Complete CRUD + admin |
| Entitlements | `apps/api/src/modules/entitlements/` | ✅ Works, not surfaced in UI |

---

*Report generated by Principal Engineer Audit · DSA OS Codebase · June 2026*
*Total files analyzed: 839 across 3 apps, 17 migrations, 4 packages*
