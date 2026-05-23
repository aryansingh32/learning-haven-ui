# Build Haven platform requirements
_Exported on 17/05/2026 at 16:33:04 GMT+5:30 from Cursor (3.3.30)_

---

**User**

firstly understand current codebase then

Technical Implementation Prompt: Build Haven (CodeCrafters Clone) — Modular & Fully Admin-Driven
Objective
Build a fully dynamic "Build your own X" platform (called Build Haven) inside Learning Haven that provides an experience identical to CodeCrafters.io, but completely driven from the Admin Panel with zero hardcoding.
Everything — challenges, stages, supported languages, prerequisites, test configurations, hints, etc. — must be configurable by admins.

Core Philosophy

Reuse existing Apprenticeship Module wherever possible.
Make Build Challenges a specialized type of Apprenticeship Program.
Keep the system highly modular and extensible.


1. Relationship with Existing Apprenticeship Module
Recommendation: Extend, Do Not Duplicate
We can reuse the existing Apprenticeship system with minimal changes:

apprenticeship_programs table → Add a new column type ('standard' | 'build_challenge')
For type = 'build_challenge':
Enable staged testing via Git pushes
Use stages instead of (or in addition to) projects
Enable GitHub repo auto-provisioning (already exists)
Use existing verification worker + Docker support


Decision:
Use the existing apprenticeship_* tables as the base and extend them for Build Challenges. This gives us progress tracking, enrollments, certificates, leaderboards, and admin UI almost for free.

2. Admin Panel Requirements (Fully Dynamic)
Build Challenges Management

CRUD for Challenges (under Admin → Build Challenges)
Fields:
Title, Slug, Description, Short Tagline, Thumbnail
Difficulty, Status (Draft/Beta/Live), Is Free in Beta
Prerequisites (rich text / markdown)
What will I build? (markdown)
What will I learn? (markdown)
Why should I build this? (markdown)
Supported Languages (multi-select: Python, Node.js, Java, C++, Go, etc.)


Stages Management (Per Challenge)

Drag & drop ordering
Each stage has:
Stage Number (auto or manual)
Title
Difficulty (Easy/Medium/Hard)
Description (Markdown)
Instructions (Markdown + Code blocks support)
Code Example (with diff highlighting support)
Hints (array of strings)
Test Configuration:
test_command
docker_test_image (override per stage if needed)
expected_exit_code
success_criteria (JSONB for custom validation rules)

Estimated time
Resources / Docs links


Language-Specific Configuration

For each challenge + language combination:
Starter Repository URL
Default Docker Test Image
Setup Instructions (markdown)



3. Student-Facing Flow (Must Match CodeCrafters)

Catalog → /build
Challenge Detail Page → /build/:slug
All content pulled dynamically from DB (no hardcoding)
Show supported languages as cards
“Start Challenge” button

Start Challenge:
Choose language → Backend creates private GitHub repo from starter template
Show clone command + setup guide

Workspace → /build/:slug/workspace
Left sidebar: List of all stages with status (Locked / In Progress / Completed)
Main area: Current stage instructions, hints, code example
Bottom/Right: Live test logs + feedback from last push
Real-time updates via Supabase

Git Push Flow:
User pushes → GitHub webhook → BullMQ job
System determines current stage of the user
Runs tests for that specific stage only
Returns rich feedback (pass/fail + logs + next hint)
On success → unlock next stage + realtime UI update



4. Technical Architecture Requirements
Backend (Modular):

Extend ApprenticeshipService or create BuildChallengeService
New or extended worker: build-verification.worker.ts
GitHub webhook handler should route based on program type
All business logic driven by database configuration

Database Extensions (Supabase):

Add type column to apprenticeship_programs
Enhance apprenticeship_projects or create build_stages table (linked to program)
Add build_challenge_languages junction table
Extend apprenticeship_enrollments with current_stage, repo_full_name, etc.

Frontend:

All components should be generic and data-driven
No hardcoded strings for any challenge content


5. Non-Functional Requirements

Fully responsive and beautiful UI (match CodeCrafters quality)
Fast feedback (< 20 seconds ideal after git push)
Secure Docker sandbox with timeouts and resource limits
Comprehensive admin preview mode for stages
Support Markdown + code syntax highlighting everywhere
Leaderboard, Recent Attempts, Certificates (reuse existing)
Rate limiting on test runs


Acceptance Criteria:

Admin can create a complete new challenge (e.g., “Build your own HTTP Server”) with 8 stages entirely from the admin panel.
No challenge-specific logic is hardcoded in frontend or backend.
Student can complete stages via git push with real-time feedback.
The system reuses maximum existing code from Apprenticeship module.


Priority Order:

Extend Apprenticeship tables + services
Admin panel for challenges & stages
GitHub + Webhook + Test Runner integration
Student Workspace UI (dynamic)
Catalog + Challenge Detail pages

Project: Build Haven (CodeCrafters Mode) — Technical Specification
Goal: Create a production-grade “Build your own X” platform inside Learning Haven that gives exactly the same experience as CodeCrafters.io, optimized for Indian college students and beginners.

1. Core User Flow (Exact CodeCrafters Experience)

Catalog / Challenges Page
Grid of challenges (Git, Redis, HTTP Server, Claude Code, Mini Docker, etc.)
Filters: Language, Difficulty, Status (Free / Beta / Premium)
Each card shows: Title, Short description, Languages supported, Stages count, Completion %

Challenge Detail Page (like the “Build your own Claude Code” example)
Hero section with title, tagline, “Free in Beta”
What will I build?
What will I learn?
Why should I build this?
Prerequisites
Supported Languages (Python, Node.js, Java, C++, Go — with separate starter repos)
Stages list (accordion or vertical stepper)
Recent Attempts / Leaderboard snippet
Big “Start Challenge” button

Starting a Challenge
User clicks Start Challenge → chooses language
Backend creates a private GitHub repository from the official starter template for that language
User is given:
Repo URL
git clone command
Setup instructions (very beginner friendly, with screenshots/Hinglish)


Working on the Challenge
User works locally in VS Code
Makes changes → git push
Platform detects push via GitHub webhook

Automated Feedback Loop
Webhook → BullMQ job
Spins up isolated Docker container using the challenge’s test_image
Runs tests only for the current stage the user is on
Returns rich feedback (pass/fail + logs + hints)
Updates progress in real-time via Supabase Realtime
Unlocks next stage on success



2. Admin Panel — Challenge & Stage Management
New Section: “Build Challenges”
A. Challenges CRUD

Title, slug, description, short_tagline
Difficulty (Beginner / Easy / Medium / Hard)
Status (Draft / Beta / Live / Archived)
Thumbnail image
Pricing (Free / Pro / One-time)
Multiple supported languages
starter_repo_url per language
docker_test_image (base image for testing)

B. Stages Management (Most Important)
Each stage contains:






































































FieldTypeDescriptionstage_numberint1, 2, 3...titlestring“Advertise the read tool”difficultyenumEasy / Medium / HarddescriptionMarkdownFull explanation + learning goalinstructionsMarkdownDetailed taskcode_examplestringCode snippet (with diff support)hintsarray of stringsHint #1, Hint #2test_commandstringCommand to run inside Dockerexpected_exit_codeintUsually 0success_criteriaJSONCustom validation rulesdocs_urlstringOptional external linkimage_urlstringScreenshot / diagram for this stage
-- Main challenge
create table build_challenges (
    id uuid primary key,
    slug text unique,
    title text,
    description text,
    status text,
    difficulty text,
    is_free boolean default false,
    created_at timestamp
);

-- Language specific starters
create table build_challenge_languages (
    challenge_id uuid,
    language text, -- python, nodejs, java, cpp
    starter_repo_url text,
    docker_test_image text
);

-- Stages
create table build_stages (
    id uuid primary key,
    challenge_id uuid references build_challenges,
    stage_number int,
    title text,
    description text,
    instructions text,
    hints jsonb,
    code_example text,
    test_command text,
    success_criteria jsonb,
    difficulty text
);

-- User progress
create table build_enrollments (
    user_id uuid,
    challenge_id uuid,
    current_stage int default 1,
    completed_stages int[] default '{}',
    repo_full_name text,
    status text, -- in_progress, completed
    started_at timestamp,
    completed_at timestamp
);
4. Backend Requirements

GitHub App / OAuth for repo creation & webhook management
Secure webhook verification (HMAC)
BullMQ worker for test execution
Docker sandbox with strict resource limits (CPU, Memory, Time)
Store test logs and feedback
Real-time progress update via Supabase


5. Frontend Requirements
Pages to build:

/build → Catalog
/build/:slug → Challenge detail page (exact same layout as CodeCrafters)
/build/:slug/workspace → Live workspace with:
Stage list (left sidebar)
Current stage instructions + hints
Terminal / Logs window
Progress bar
“Submit / Run Tests” button (optional, since push also works)


Real-time Features:

Stage completion celebration animation
Leaderboard per challenge
Recent attempts


Example Stage Structure (from your Claude Code example)
Stage Title: Advertise the read tool
Difficulty: Easy
Description: In this stage, you'll add support for advertising the Read tool...
Instructions + Code Example (with diff highlighting)
Hints:

Hint #1: How do I advertise tools...
Hint #2: ...

Test Runner will execute:
./your_program.sh -p "How many tools are available to you in this request? Number only."
Success Criteria for MVP

Admin can create challenge + 6–10 stages
Student can start challenge → gets private repo
git push → triggers test → feedback appears in UI within 10–20 seconds
Stage-by-stage progression with clear feedback
Works for at least Python and Node.js initially
Beautiful, beginner-friendly UI 
use supabase MCP for supabase changes

---

**Cursor**

I’ll first map the existing apprenticeship architecture in both backend and admin/frontend, then implement Build Haven as an extension of that module (not a duplicate), starting with schema + backend routing/services and then admin/student data-driven pages. I’m beginning by loading the Supabase skill guidance and scanning the relevant code paths.

I found an existing `backend/src/modules/build-haven/types.ts`, so next I’m inspecting apprenticeship + build-haven + current frontend/admin apprenticeship wiring to extend what’s already there instead of reinventing it.

I’ve confirmed there’s already a strong apprenticeship + GitHub/webhook/worker base and even a starter `build-haven` type file. Next I’ll wire a full Build Haven module end-to-end by extending existing tables/services and adding admin + student routes/pages driven by DB content, then hook webhook/worker routing by program type.

I’m now authenticated to Supabase MCP. I’ll use it to inspect the connected project and (if available) apply the schema extension SQL directly, while also adding matching migration/code updates in the repo so everything stays versioned.

I’ve verified the Supabase schema already contains `program_type` + `build_*` tables, so I’m implementing the missing code layer now: new Build Haven backend module (public + admin APIs), webhook routing for build repos, and a dedicated build verification worker that evaluates the current stage and unlocks progression.

Backend module wiring is in place. Next I’m adding the student `/build` experience and an admin Build Challenges screen, all powered by the new API endpoints so challenge/stage/language content is fully dynamic from DB.

Implemented a full **Build Haven foundation** on top of your existing apprenticeship stack, with dynamic DB-driven challenge/stage/language flow and no challenge-specific hardcoding in code paths.

### What I changed

- Extended backend with a new Build Haven module:
  - `backend/src/modules/build-haven/service.ts`
  - `backend/src/modules/build-haven/controller.ts`
  - `backend/src/modules/build-haven/routes.ts`
- Added a dedicated build verification worker:
  - `backend/src/workers/build-verification.worker.ts`
  - wired in `backend/src/app.ts`
- Mounted Build Haven API:
  - `backend/src/routes/index.ts` adds `/api/v1/build`
- Integrated GitHub webhook routing by repo type:
  - `backend/src/modules/github/github.controller.ts` now checks `build_enrollments` repo first, validates webhook HMAC, and queues build verification.

### New backend API surface

- Public/student:
  - `GET /api/v1/build/challenges`
  - `GET /api/v1/build/challenges/:slug`
  - `GET /api/v1/build/challenges/:slug/workspace`
  - `POST /api/v1/build/challenges/:slug/start`
- Admin:
  - `GET/POST /api/v1/build/admin/challenges`
  - `GET/PUT /api/v1/build/admin/challenges/:id`
  - `GET/POST /api/v1/build/admin/challenges/:programId/stages`
  - `PUT /api/v1/build/admin/stages/:stageId`
  - `DELETE /api/v1/build/admin/stages/:stageId`
  - `PUT /api/v1/build/admin/challenges/:programId/stages/reorder`
  - `GET/POST /api/v1/build/admin/challenges/:programId/languages`
  - `DELETE /api/v1/build/admin/challenges/:programId/languages/:language`

### Student-facing Build Haven UI

- Added new pages:
  - `src/pages/BuildCatalogPage.tsx` (`/build`)
  - `src/pages/BuildChallengePage.tsx` (`/build/:slug`)
  - `src/pages/BuildWorkspacePage.tsx` (`/build/:slug/workspace`)
- Added client service:
  - `src/services/build-haven.service.ts`
- Registered routes:
  - `src/App.tsx`

### Admin panel additions

- Added admin service:
  - `admin/src/services/build-haven.service.ts`
- Added Build Challenges management page:
  - `admin/src/pages/apprenticeship/BuildChallengesPage.tsx`
  - supports challenge create/update + stage create + language upsert + basic preview
- Hooked route + sidebar:
  - `admin/src/App.tsx`
  - `admin/src/components/Sidebar.tsx`

### Supabase MCP usage

- Authenticated Supabase MCP and verified live schema in your active project.
- Confirmed `program_type` and `build_*` tables already exist, so I implemented against those directly (no speculative schema rewrite).

### Verification status

- `ReadLints` reports **no lint errors** in touched files.
- Admin build succeeded.
- Backend build currently fails due **pre-existing unrelated TypeScript errors** in other modules (e.g. `resume.controller`, `javaExecutor`, etc.), plus I fixed the new Build Haven controller typing issues I introduced.
- Frontend root build ended abnormally in this run (no concrete compile error emitted), likely interrupted/terminated during long build; admin build output is healthy.

---

If you want, next I can do phase 2 immediately:
1) stage-level drag/drop reorder UI in admin,  
2) markdown rendering + code syntax UI in student workspace,  
3) realtime subscription for `build:*` channels in workspace,  
4) tighten test execution to per-stage `expected_exit_code` and richer feedback payload.

---

**User**

yes go for phase 2 Goal: Polish the Build Haven experience to feel truly like CodeCrafters — rich UI, smooth admin experience, real-time feedback, and robust per-stage testing.

Phase 2 Requirements (Modular & Dynamic)
1. Admin Panel Improvements
A. Build Challenges Management

Enhance BuildChallengesPage.tsx with tabs:
Overview
Stages (with drag & drop reordering using @dnd-kit or react-beautiful-dnd)
Languages / Starters
Preview Mode (shows how the challenge page will look to students)


B. Stage Editor

Rich Markdown editor for:
Description
Instructions
Code Example (with diff support)

Hints management (add/remove/reorder)
Test Configuration section:
test_command
docker_test_image
expected_exit_code
timeout_seconds
success_criteria (JSON editor)


2. Student-Facing Experience (Critical)
A. BuildChallengePage.tsx (/build/:slug)

Exact CodeCrafters-style layout
Dynamic sections: What will I build? / Learn? / Why? / Prerequisites
Supported languages as selectable cards
“Start Challenge” button (calls POST /start)

B. BuildWorkspacePage.tsx (/build/:slug/workspace)

Left Sidebar: All stages as vertical stepper
Status: Not Started / In Progress / Completed / Locked
Click to switch current stage

Main Content:
Current stage title + difficulty badge
Markdown rendered instructions + code examples (use react-markdown + rehype-highlight)
Hints section (collapsible, with “Show Hint” buttons — limit reveals)

Right / Bottom Panel:
Live Test Logs
Last test result (Pass/Fail with colored output)

Real-time Updates:
Subscribe to Supabase realtime on user’s enrollment (build_enrollments + stages)


3. Backend Enhancements

build-verification.worker.ts:
Determine user’s current_stage
Run tests only for that stage
Return structured feedback:

CodeCrafters UI refrence just for refrense and functionalities i have pasted the screenshot and below refrence
CodeCrafters Workspace UI Analysis (Key Insights)
Overall Layout (3-Column Design)

Left Sidebar (Navigation)
Challenge title + language (Build your own Shell using Java)
Vertical list of all stages with status indicators:
Green check = Completed
Dark highlight = Current stage
Gray # = Locked / Not started

Collapsible section (NAVIGATION)

Main Content Area (Dynamic based on tab)
Top Tabs: Instructions | Code Examples | Concepts | Forum
Instructions Tab (most important):
Stage title + difficulty badge (Implement exit #PNS + In-progress + EASY)
"Your Task" section
Detailed explanation with highlighted keywords
Tests section (how tester runs the program)
Example terminal interaction
"How to pass this stage" + Hints (collapsible)
Code snippet with "Reveal complete solution" button (green)
Submit instructions + git push commands


Right Sidebar
Language Leaderboard (Top users + current user highlighted)
Stage info (Stage #PNS In-progress)


Key UX Patterns to Replicate









































ElementDetailsDark ThemeDeep navy/black background, good contrastStage StatusGreen check, highlighted current, locked with #HintsCollapsible cards with "Hint #1", "Hint #2"Solution RevealProminent green button "Reveal complete solution" (with code diff)Test FeedbackRed "Tests failed" banner at bottom with "Show logs"Git CommandsProminent copyable blocks for git add, commit, pushProgressVisual stage list on left makes progress obviousInteractivityClickable stages on left to switch context



critical make sure the entire system is fully controllable from admin panel admin can do everything no hardcoding anywhere full SAAS level admin panel

---

**Cursor**

Implementing Phase 2: reviewing the codebase and schema, then adding admin tabs (stages with drag-and-drop, languages, preview), enhancing the worker and API, and rebuilding student pages to match the CodeCrafters-style layout.



Implementing Phase 2: adding DB columns for stage-level Docker/timeout and structured feedback, enhancing the verification service and worker, then building the admin and student UIs.



Implementing service-layer verification logic and API updates.



Phase 2 is in a good **complete** state for what was scoped: admin can manage challenges end-to-end, the student flow matches the CodeCrafters-style layout and behavior, and the worker runs **per-stage** tests with structured feedback and realtime-style updates via **Supabase broadcast**.

### What you have now

**Admin (`BuildChallengesPage`)**  
- Tabs: **Overview | Stages | Languages | Preview**  
- **Stages**: drag-and-drop reorder (`reorderStages`), full **stage editor** (markdown fields, hints, test command, Docker image, timeout, exit code, **success_criteria** JSON)  
- **Preview** mirrors the student challenge page from stored content  

**Student**  
- **`/build/:slug`**: dynamic sections from DB, language cards, **Start** → `POST /start` → workspace with `?language=`  
- **`/build/:slug/workspace`**: 3-column workspace, stepper, tabs, hints with limited reveals, solution toggle, git copy block, bottom test strip, **broadcast** on `build:{enrollmentId}`  

**Backend**  
- Verification uses **current stage**, stage/language Docker + timeout + exit code + **success_criteria**, persists **`structured_feedback`**, broadcasts lifecycle events  

### Small fix just applied

- **`BuildChallengesPage` stage update**: `success_criteria` JSON is parsed inside **try/catch** so invalid JSON surfaces as a clear error instead of a cryptic failure.

### Builds

- **Main app** `npm run build` — **success**  
- **Admin** `npm run build` — **success** (only existing CSS `@import` warning)

### Optional next steps (not blocking Phase 2)

- **Postgres Realtime** on enrollments if you want DB-driven updates without relying only on worker broadcast.  
- **Leaderboard**: join `users` for display names/avatars instead of truncated ids.  
- **Concepts / Forum** tabs: flesh out when you have content models.  
- **Ops**: `GITHUB_BOT_TOKEN`, Docker on workers, optional **rate limits** on verify jobs.

If you want a follow-up pass, say whether you prefer **Realtime on `build_enrollments`** or **leaderboard profile enrichment** first.

---

**User**

we have a side panelDOM Path: div#root > div.min-h-.creen bg-depth tran.ition-color. duration-400 > aside.fixed left-0 top-0 bottom-0 w-[260px] card-gla. z-30 flex flex-col border-r border-border/40
Position: top=0px, left=0px, width=260px, height=379px
React Component: AppLayout
HTML Element: <aside class="fixed left-0 top-0 bottom-0 w-[260px] card-glass z-30 flex flex-col border-r border-border/40" data-cursor-element-id="cursor-el-313">DSA OS Master Algorithms MAIN Dashboard Learn Profile MORE Apprenticeship Visualizer Jobs AI Coach Resume Referrals Certificates Dark Mode S Super Admin Level 1 • 0 XP Sign Out</aside> and inside the main each page is shown but  DOM Path: div#root > div.min-h-.creen bg-depth tran.ition-color. duration-400 > main.min-h-.creen tran.ition-all duration-300 ml-[260px] p-6 lg:p-8
Position: top=0px, left=260px, width=749px, height=1087px
React Component: AppLayout
HTML Element: <main class="min-h-screen transition-all duration-300 ml-[260px] p-6 lg:p-8" data-cursor-element-id="cursor-el-113">Day 1 🔥 Super. Keep going. Start your streak today. Start earning XP S Chapter 4: Functions You're 38% through this chapter. Don't stop now. Continue Learning Today's Goal ~30 min Complete: Crac</main> the apprenticship page is not showing in main and aside side panel is not showing it is displaying fully DOM Path: div#root > div.container mx-auto px-4 py-12 max-w-7xl animate-fade-in fade-in-0 duration-500
Position: top=0px, left=0px, width=1009px, height=1289px
React Component: ApprenticeshipsPage
HTML Element: <div class="container mx-auto px-4 py-12 max-w-7xl animate-fade-in fade-in-0 duration-500" data-cursor-element-id="cursor-el-526">GUARANTEED PRACTICAL EXPERIENCE Build Real Projects. Get Verified Automatically. Don't just watch tutorials. Build production-grade software following professional requirements. Every push to GitHub</div>, change the apprenticeship to something else we will show projects which users will build soemthing like projects,build your own x or any other attractive and content it shows should be the our codecrafters clone entirely should show in this, and the apprenticeship programs goes in Jobs where internships and apprenticeships both will be there, remove the visualizer for now we dont need it sepearetely if we need visualization we will add them inside chapters only  after doing all the changes track and analyze the chapters system/Learn from admin panel,backend and frontend make sure everything is dynamic and we can perform the CRUD operations on it via the admin panel, chapter is lock unlock conditionts to lock unlock, realtime progress tracking Update our platform with these production-grade changes

---

**Cursor**

Exploring routing, layout, and navigation to fix the apprenticeship layout issue and implement the restructure.


Implementing navigation restructure, Projects hub in AppLayout, Jobs integration for apprenticeships, dynamic Learn/chapters with admin CRUD, and realtime progress.


