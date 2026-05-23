# MASTER AI PROMPT — Learning Haven Apprenticeship System
### "Build, Verify, Ship" — A CodeCrafters-Inspired Internship Platform

---

> **How to use this prompt**: Copy everything from the `---BEGIN PROMPT---` marker to the `---END PROMPT---` marker and paste it as your first message to the AI. It is self-contained — no additional context is needed. Replace all `[BRACKETED VALUES]` before sending.

---

---BEGIN PROMPT---

## YOUR MISSION

You are a senior full-stack architect. Your task is to design and build a complete, standalone **Apprenticeship & Internship Platform** — inspired by CodeCrafters — for a product called **Learning Haven**. This system must be built as a fully self-contained module that can later be integrated into the existing Learning Haven ecosystem (React 18 frontend, Node.js/TypeScript backend, Supabase/PostgreSQL, Redis, BullMQ).

The system has ONE core promise to its users:

> **"Build real projects. Get verified automatically. Earn a certificate. Land a job."**

Students follow a guided path to build 5 production-grade projects. Every push to GitHub is automatically verified. Progress is tracked in real time. The entire system — from project creation to user logs to monetization — is controlled from a powerful admin dashboard.

This is NOT a tutorial platform. This is a **build-and-verify** platform. Students write real code for real projects. The platform tests that code automatically.

---

## SECTION 1 — SYSTEM OVERVIEW & PHILOSOPHY

### 1.1 The Two Learning Paths

Every project in the system supports BOTH paths simultaneously. A student picks one when they enroll. They can switch at any time by contacting support. The path affects the guide content — not the tests.

**Path A — Traditional (Guided)**
Step-by-step instructions. Conceptual explanations. Code snippets for each function. Hints when stuck. Designed for students who want to deeply understand what they are building.

**Path B — AI-Assisted (Vibe Coding)**
High-level prompts optimized for Cursor, Copilot, and ChatGPT. Best-practice AI usage guidelines. Tips to avoid hallucinations and review AI output for security issues. Designed for students who want to build faster using AI tools — as real engineers do today.

**Critical design principle**: The automated verification tests are IDENTICAL for both paths. The system does not care how the code was written. It only checks if the final product works correctly. A student who used AI to build a perfect REST API gets the same verification pass as a student who wrote every line manually.

### 1.2 The Verification Philosophy

All projects use a single verification mode, controlled from the admin panel:

**Fully Automated (GitHub Webhook)**
The student connects GitHub once. The platform creates a repository. Every `git push` triggers automated Docker-based testing. Results appear in the student's browser within 90 seconds. No forms, no URL pasting, no commit hashes. This applies to every project including Project 1.

---

## SECTION 2 — COMPLETE FEATURE LIST

### 2.1 Student-Facing Features

#### Enrollment & Onboarding
- Public landing page for each program with pricing, project previews, tech stack, testimonials, and a live enrollment counter
- Razorpay payment integration (amount in INR, coupon code support)
- Post-payment: immediate dashboard access, Discord invite link, welcome email via Resend
- Referral code application at checkout
- Program enrollment is time-gated: student gets `duration_days` to complete all projects from the enrollment date

#### Project Workspace
- Sequential project unlocking: Project N+1 unlocks only after Project N passes verification
- Each project page has:
  - Estimated hours
  - Starter repository (auto-cloned to student's GitHub on "Start Project" click)
  - Full guide (Traditional OR AI-Assisted, based on enrolled path)
  - Verification requirements panel showing exactly what tests will run
  - Real-time test result panel (Stage-by-stage, lights up green/red as results arrive)
  - Submission history (all previous attempts, with full test output)
  - "Get AI Help" button (rate-limited: 10 queries/hour)
  - Link to reference solution (visible ONLY after project is passed)
  - Helpful resources section

#### GitHub Integration (All Projects)
- One-time "Connect GitHub" OAuth flow (scope: `repo`) — required before starting Project 1
- On "Start Project": platform auto-creates repo from template in student's GitHub account, installs webhook, returns clone URL in one step
- Student workflow from that point: `git push` → see results
- Student NEVER interacts with a submission form, commit hash, or webhook URL
- Webhook signature verification (HMAC-SHA256) prevents cheating

#### Real-Time Verification Results
- Supabase Realtime subscription on the student's submission channel
- Results stream in stage by stage — each test group lights up independently
- Each passing stage awards XP in real time (toast notification)
- Failed stages show the exact error message and last 20 lines of console output
- Overall result: PASS (next project unlocked) or FAIL (retry immediately)

#### AI Help System
- Per-project AI assistant powered by the backend AI service (GPT-4o)
- Context-aware: knows the current project, the student's learning path, and their last failed test output
- Rate-limited: 10 queries per hour per student
- Remaining query count displayed in the UI
- All queries logged for admin review

#### Community
- Program-scoped discussion board (enrolled students only)
- Filter posts by project
- Upvoting, replies, image attachments
- Helpful Contributor badge for students with 10+ upvoted replies

#### Leaderboard
- Three leaderboard types: Fastest Completion, Highest Code Quality, Most Helpful (community)
- Student's own rank and percentile shown
- Public-facing: visible to non-enrolled visitors (for social proof)

#### Certificates
- Auto-generated when all projects pass
- PDF download + shareable URL at `certificates.learninghaven.com/:code`
- Verification endpoint (public, no auth): confirms authenticity, recipient name, completion date, grade
- Grade based on average code quality score across all projects (Distinction / Merit / Pass)
- Pre-written LinkedIn post copy and OG share image for social distribution

#### Student Dashboard
- Enrollment status and days remaining
- Progress bar across all projects
- "On Track" indicator (based on average completion pace)
- Recent activity feed
- XP earned from this program
- Quick-access to current project

---

### 2.2 Admin-Facing Features

This is the most critical part of the system. The admin must be able to control everything without touching code.

#### Program Management
- Create / Edit / Archive programs
- Fields: title, slug, description, duration_days, price_inr, original_price_inr, tech_stack, difficulty_level, max_enrollments, learning_paths (toggle Traditional / AI-Assisted / Both), status (draft / active / archived)
- Preview mode: see exactly what a student will see before publishing
- Enrollment cap management: set, increase, or remove the cap at any time
- Drag-to-reorder projects within a program

#### Project Management
- Create / Edit / Delete projects within a program
- Fields per project:
  - Title, description, estimated hours
  - Traditional guide (rich text editor with code block support)
  - AI-Assisted guide (prompt list editor with phase labels and expected outcomes)
  - Starter repo URL (template repository on Learning Haven's GitHub org)
  - Helpful resources (title + URL pairs)
  - Verification requirements (endpoint list, test count, deployment required toggle)
  - Unlock condition (always "complete previous project" — no configuration needed)
  - Verification mode: Automated (GitHub) / Manual Review
- Test suite management: upload or link the Docker-based test file for each project
- Reference solution URL (hidden from students until they pass)

#### Verification & Submission Review
- Live submission feed: every submission across all programs, with status (testing / passed / failed)
- Filter by: program, project, status, date range, student
- Manual override: admin can mark any submission as passed or failed with a note
- Code quality score override
- XP bonus field for exceptional work
- "Flag for review" system: automated tests can escalate to manual review when a non-standard approach is detected
- Manual review queue with SLA tracking (shows "waiting X hours")

#### User Management
- Full user list with search, filter by program, filter by enrollment status
- Per-user view:
  - All enrollments and their status
  - Full submission history across all projects
  - Complete activity log (every page visit, button click, AI query)
  - GitHub connection status
  - XP earned, certificates issued
  - Payment history
- Admin actions: force-unlock a project, reset a submission, revoke enrollment, issue certificate manually, add XP manually, ban user from platform

#### Analytics Dashboard
- Overview KPIs: total enrollments, active enrollments, total revenue, average completion rate, average time-to-complete, total certificates issued
- By program: breakdown of all KPIs per program
- By month: enrollment and revenue trends (chart)
- Funnel analysis: enrolled → started project 1 → completed project 1 → ... → certified
- Drop-off identification: which project has the highest failure/abandonment rate
- Top performers list (fastest completions)
- Struggling students list (enrolled > 14 days, 0 projects completed) — for outreach
- AI query analytics: most common questions per project (for guide improvement)
- Code quality distribution: histogram of quality scores per project

#### Activity & Behavior Monitoring (Every User, Every Action)
This is non-negotiable. Build a complete event logging system.

Every event must be stored with: `user_id`, `session_id`, `event_type`, `event_data` (JSONB), `page_url`, `ip_address`, `user_agent`, `timestamp`.

Logged events include (but are not limited to):
- Page views (with time-on-page when they leave)
- "Start Project" button click
- GitHub OAuth initiated / completed / failed
- Repo creation success/failure
- Git push received (webhook event)
- Verification job queued / started / completed
- Each test stage result received
- "Get AI Help" button click + query text + response
- Community post created / upvoted
- Certificate generated / downloaded / shared
- Payment initiated / completed / failed
- Coupon code applied (valid or invalid)
- Referral code applied
- Any admin action taken (with before/after state)

Admin can view:
- Per-user timeline (chronological event log, filterable by event type)
- Session replay metadata (not video — just the sequence of events in a session)
- Real-time "who is online right now" panel
- Funnel drop-off events (what was the last action before a student went inactive)

#### Financial Management
- Revenue dashboard: gross, net (after Razorpay fees), by program, by month
- Coupon code manager: create codes with fixed amount or percentage discount, usage limit, expiry date, per-user limit
- Refund management: initiate refunds, track status
- Referral payout queue (inherits from existing referral system)

#### Notification Center
- Send targeted notifications to: all enrolled students in a program / students on a specific project / students who haven't pushed in X days / individual user
- Channels: in-app notification + email (via Resend)
- Template editor for email notifications
- Scheduled sends

---

## SECTION 3 — DATABASE SCHEMA

Design the following tables in Supabase (PostgreSQL). Use UUIDs for all primary keys. Use `timestamptz` for all timestamps. Enable Row Level Security where specified.

### Core Program Tables

```sql
-- Programs (the top-level container)
apprenticeship_programs (
  id uuid PK,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  duration_days integer NOT NULL,
  price_inr integer NOT NULL,          -- stored in paise
  original_price_inr integer,
  tech_stack text[],
  difficulty_level text CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  total_projects integer NOT NULL,
  learning_paths text[] DEFAULT '{traditional,ai_assisted}',
  max_enrollments integer,
  enrolled_count integer DEFAULT 0,
  avg_completion_rate numeric(4,3),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  certificate_preview_url text,
  community_size integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Projects within a program
apprenticeship_projects (
  id uuid PK,
  program_id uuid FK → apprenticeship_programs,
  project_number integer NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  estimated_hours integer,
  traditional_guide jsonb,             -- {steps: [{step_number, title, description, code_snippets[], verification_hints}]}
  ai_guide jsonb,                      -- {overview, recommended_prompts[], best_practices[]}
  starter_repo_url text,
  reference_solution_url text,
  helpful_resources jsonb,             -- [{title, url}]
  verification_mode text DEFAULT 'automated' CHECK (verification_mode IN ('automated', 'manual')),
  verification_requirements jsonb,     -- {required_endpoints[], required_tests, deployment_required}
  docker_test_image text,
  unlock_condition text DEFAULT 'complete_previous',
  is_active boolean DEFAULT true,
  sort_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(program_id, project_number)
)
```

### Enrollment & Progress Tables

```sql
-- Student enrollments
apprenticeship_enrollments (
  id uuid PK,
  user_id uuid FK → users,
  program_id uuid FK → apprenticeship_programs,
  payment_id uuid,
  referral_code text,
  learning_path text DEFAULT 'traditional' CHECK (learning_path IN ('traditional', 'ai_assisted')),
  enrolled_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  current_project_number integer DEFAULT 1,
  completed_projects integer DEFAULT 0,
  total_projects integer NOT NULL,
  progress_percentage numeric(5,2) DEFAULT 0,
  certificate_issued boolean DEFAULT false,
  certificate_id uuid,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed', 'revoked')),
  discord_invited boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
)

-- Per-project progress
apprenticeship_project_progress (
  id uuid PK,
  enrollment_id uuid FK → apprenticeship_enrollments,
  project_id uuid FK → apprenticeship_projects,
  user_id uuid FK → users,
  status text DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'passed', 'skipped')),
  github_repo_full_name text,
  github_repo_url text,
  webhook_secret text,                 -- encrypted
  started_at timestamptz,
  passed_at timestamptz,
  attempts_count integer DEFAULT 0,
  best_code_quality_score integer,
  total_xp_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(enrollment_id, project_id)
)
```

### Submission & Verification Tables

```sql
-- Individual submission attempts
apprenticeship_submissions (
  id uuid PK,
  enrollment_id uuid FK → apprenticeship_enrollments,
  project_progress_id uuid FK → apprenticeship_project_progress,
  user_id uuid FK → users,
  project_id uuid FK → apprenticeship_projects,
  github_repo_full_name text,
  commit_hash text,
  live_url text,
  learning_path text,
  attempt_number integer NOT NULL,
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'testing', 'passed', 'failed', 'manual_review', 'manual_passed', 'manual_failed')),
  
  -- Test results
  total_tests integer,
  passed_tests integer,
  failed_tests jsonb,                  -- [{name, error, expected, actual}]
  code_quality_score integer,
  security_issues jsonb,
  performance_score integer,
  execution_time_ms integer,
  console_output_tail text,            -- last 20 lines
  
  -- Manual review
  reviewer_id uuid,
  reviewer_notes text,
  code_quality_override integer,
  xp_bonus integer DEFAULT 0,
  reviewed_at timestamptz,
  
  -- Timing
  submitted_at timestamptz DEFAULT now(),
  testing_started_at timestamptz,
  verified_at timestamptz,
  xp_awarded integer DEFAULT 0,
  
  -- Flags
  flagged_for_review boolean DEFAULT false,
  flag_reason text
)

-- Stage-by-stage test results (for real-time streaming)
apprenticeship_test_stages (
  id uuid PK,
  submission_id uuid FK → apprenticeship_submissions,
  stage_number integer NOT NULL,
  stage_name text NOT NULL,
  status text CHECK (status IN ('pending', 'running', 'passed', 'failed')),
  tests_in_stage integer,
  passed_in_stage integer,
  failed_details jsonb,
  xp_for_stage integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz
)
```

### GitHub Integration Tables

```sql
-- GitHub OAuth tokens per user
apprenticeship_github_connections (
  id uuid PK,
  user_id uuid FK → users UNIQUE,
  github_username text NOT NULL,
  github_user_id bigint NOT NULL,
  access_token text NOT NULL,          -- AES-256 encrypted
  token_scopes text[],
  connected_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  revoked_at timestamptz
)
```

### Community Tables

```sql
apprenticeship_posts (
  id uuid PK,
  program_id uuid FK → apprenticeship_programs,
  project_id uuid FK → apprenticeship_projects,
  user_id uuid FK → users,
  content text NOT NULL,
  attachments jsonb,
  upvotes integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

apprenticeship_post_upvotes (
  post_id uuid FK → apprenticeship_posts,
  user_id uuid FK → users,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
)

apprenticeship_post_replies (
  id uuid PK,
  post_id uuid FK → apprenticeship_posts,
  user_id uuid FK → users,
  content text NOT NULL,
  upvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
)
```

### Certificates Table

```sql
apprenticeship_certificates (
  id uuid PK,
  enrollment_id uuid FK → apprenticeship_enrollments UNIQUE,
  user_id uuid FK → users,
  program_id uuid FK → apprenticeship_programs,
  verification_code text UNIQUE NOT NULL,    -- e.g. "LH-2025-FSWEB-001247"
  recipient_name text NOT NULL,
  final_grade text CHECK (final_grade IN ('Distinction', 'Merit', 'Pass')),
  avg_code_quality_score numeric(5,2),
  projects_completed integer NOT NULL,
  certificate_url text,
  pdf_url text,
  social_share_image_url text,
  issued_at timestamptz DEFAULT now()
)
```

### Event Logging Table (The Monitoring System)

```sql
apprenticeship_events (
  id uuid PK,
  user_id uuid,                        -- nullable (pre-auth events)
  session_id text NOT NULL,
  event_type text NOT NULL,            -- e.g. 'page_view', 'git_push_received', 'test_stage_passed'
  event_category text NOT NULL,        -- 'navigation', 'verification', 'community', 'payment', 'admin', 'github'
  event_data jsonb,                    -- flexible payload per event type
  page_url text,
  referrer_url text,
  ip_address inet,
  user_agent text,
  country_code text,
  duration_ms integer,                 -- for page_view events: time spent
  enrollment_id uuid,                  -- if event is within an enrollment context
  project_id uuid,                     -- if event is within a project context
  submission_id uuid,                  -- if event is within a submission context
  created_at timestamptz DEFAULT now()
)

-- Index heavily for admin queries
CREATE INDEX idx_apprenticeship_events_user_id ON apprenticeship_events(user_id);
CREATE INDEX idx_apprenticeship_events_event_type ON apprenticeship_events(event_type);
CREATE INDEX idx_apprenticeship_events_created_at ON apprenticeship_events(created_at DESC);
CREATE INDEX idx_apprenticeship_events_session ON apprenticeship_events(session_id);
```

### Coupon Codes Table

```sql
apprenticeship_coupons (
  id uuid PK,
  code text UNIQUE NOT NULL,
  program_id uuid,                     -- null = applies to all programs
  discount_type text CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value integer NOT NULL,     -- paise for fixed, percentage points for percentage
  max_uses integer,
  uses_count integer DEFAULT 0,
  per_user_limit integer DEFAULT 1,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid FK → users,
  created_at timestamptz DEFAULT now()
)
```

---

## SECTION 4 — BACKEND API SPECIFICATION

### Base URL: `/api/v1/apprenticeship`

Build ALL of the following endpoints. Group them by concern.

#### 4.1 Public Endpoints (No Auth)
- `GET /programs` — List active programs with pricing, enrollment counts, tech stack
- `GET /programs/:slug` — Full program detail including project previews (locked projects show title only)
- `GET /leaderboard/:programId?type=fastest|quality|helpful` — Public leaderboard
- `GET /certificates/verify/:code` — Certificate authenticity check

#### 4.2 Student Endpoints (Auth Required)

**Enrollment**
- `POST /payments/create-order` — Create Razorpay order with optional coupon code
- `POST /enroll` — Post-payment enrollment (verifies Razorpay signature, credits referral, sends Discord invite)
- `GET /enrollments/mine` — All of the current user's enrollments
- `GET /enrollments/:enrollmentId` — Full enrollment detail with project progress

**Project Workflow**
- `GET /projects/:projectId` — Full project content (auth-gated: user must have unlocked this project)
- `POST /projects/:projectId/start` — Triggers: create GitHub repo from template, install webhook, return clone URL
- `GET /submissions/mine?enrollmentId=&projectId=` — Student's submission history
- `GET /submissions/:submissionId/status` — Polling endpoint for test results

**GitHub OAuth**
- `GET /auth/github` — Redirects to GitHub OAuth (with CSRF state parameter)
- `GET /auth/github/callback` — Exchange code for token, encrypt, store, redirect to dashboard
- `DELETE /auth/github` — Disconnect GitHub

**Webhook (Public but Signature-Verified)**
- `POST /webhooks/github` — Receives push events, verifies HMAC-SHA256, queues BullMQ job

**AI Help**
- `POST /ai/project-help` — Rate-limited AI assistance (10/hour), context-aware

**Community**
- `GET /community/:programId/posts?projectId=&sort=&page=&limit=` — Discussion posts
- `POST /community/:programId/posts` — Create post
- `POST /community/posts/:postId/upvote` — Toggle upvote
- `POST /community/posts/:postId/replies` — Reply to post

**Certificates**
- `POST /certificates/generate` — Manually trigger certificate (auto-called by system on completion)

#### 4.3 Admin Endpoints (Admin Auth Required)

**Programs**
- `GET /admin/programs` — All programs including drafts
- `POST /admin/programs` — Create program
- `PUT /admin/programs/:id` — Update program
- `DELETE /admin/programs/:id` — Archive program (soft delete)
- `PUT /admin/programs/:id/reorder-projects` — Drag-to-reorder

**Projects**
- `POST /admin/programs/:programId/projects` — Add project
- `PUT /admin/projects/:id` — Update project (guide content, test requirements, etc.)
- `DELETE /admin/projects/:id` — Remove project

**Submissions & Verification**
- `GET /admin/submissions?status=&programId=&projectId=&userId=&from=&to=` — Full submission feed
- `GET /admin/submissions/pending-review` — Manual review queue with SLA timestamps
- `PUT /admin/submissions/:id/review` — Manual pass/fail with notes, XP bonus
- `POST /admin/enrollments/:id/force-unlock-project` — Admin force-unlock
- `POST /admin/enrollments/:id/reset-submission` — Wipe a submission attempt
- `POST /admin/enrollments/:id/issue-certificate` — Force issue certificate

**Users**
- `GET /admin/users?search=&programId=&status=` — User list
- `GET /admin/users/:userId` — Full user detail (enrollments, submissions, events, GitHub status)
- `GET /admin/users/:userId/events?type=&from=&to=` — Per-user activity log
- `POST /admin/users/:userId/add-xp` — Manual XP grant
- `POST /admin/users/:userId/revoke-enrollment` — Revoke with reason
- `POST /admin/users/:userId/send-notification` — Targeted notification

**Analytics**
- `GET /admin/analytics/overview` — KPIs
- `GET /admin/analytics/by-program` — Per-program breakdown
- `GET /admin/analytics/funnel/:programId` — Enrollment-to-certificate funnel
- `GET /admin/analytics/dropoff/:programId` — Which projects have highest abandonment
- `GET /admin/analytics/ai-queries?projectId=` — Most common AI questions per project
- `GET /admin/analytics/realtime` — Who is online right now

**Coupons**
- `GET /admin/coupons` — All coupon codes
- `POST /admin/coupons` — Create coupon
- `PUT /admin/coupons/:id` — Update coupon
- `DELETE /admin/coupons/:id` — Deactivate coupon

**Notifications**
- `POST /admin/notifications/broadcast` — Send to segment (all enrolled / specific program / specific project / specific user)

---

## SECTION 5 — VERIFICATION WORKER (BullMQ)

Build a BullMQ queue called `apprenticeship-verification`. The worker runs in a separate process.

### Job Payload
```typescript
interface VerificationJob {
  submissionId: string;
  userId: string;
  projectId: string;
  programId: string;
  enrollmentId: string;
  projectProgressId: string;
  repoFullName: string;     // "rahul-sharma/lh-project-2-rest-api"
  commitHash: string;
  dockerTestImage: string;
  attemptNumber: number;
}
```

### Worker Steps (Execute in Order)

1. **Update status** → Set submission `verification_status = 'testing'`, `testing_started_at = now()`
2. **Notify frontend** → Emit to Supabase Realtime channel `submission:{submissionId}` with `status: 'testing'`
3. **Clone repo** → `git clone --depth=1 https://{GITHUB_BOT_TOKEN}@github.com/{repoFullName} --branch main /tmp/verify/{submissionId}`
4. **Run Docker container** → Mount cloned code, run the project's test image, capture stdout/stderr
5. **Parse stage results** → As each test stage completes, insert row into `apprenticeship_test_stages`, emit to Realtime
6. **Calculate scores** → Code quality (linting score), security scan (detect `eval`, `exec`, hardcoded secrets), performance score
7. **Save final results** → Update `apprenticeship_submissions` with all results
8. **On PASS**:
   - Update `apprenticeship_project_progress.status = 'passed'`
   - Unlock next project (set its progress row to `available`)
   - Award XP to user
   - Update enrollment `completed_projects`, `progress_percentage`
   - If all projects complete: trigger certificate generation
9. **On FAIL**: Update submission as failed. Do not change project progress status.
10. **Cleanup** → Remove cloned files from `/tmp/verify/{submissionId}`
11. **Log event** → Insert row into `apprenticeship_events` with event_type `'verification_completed'`

### Retry Policy
- Max attempts: 3
- Backoff: exponential (30s, 90s, 270s)
- On 3rd failure: mark submission as `failed`, add `flag_reason: 'worker_error'`, alert admin via email

---

## SECTION 6 — FRONTEND SPECIFICATION

Build two separate frontend modules. Both use React 18, TypeScript, TanStack Query, Tailwind CSS, Shadcn UI, and Framer Motion.

### Module A: Student Dashboard

#### Page: Program Discovery (`/apprenticeship`)
- Hero section with headline and CTA
- Program cards: title, tech stack badges, price, completion rate, enrolled count, "spots remaining" badge if < 20% capacity left
- Filter by difficulty and tech stack

#### Page: Program Detail (`/apprenticeship/:slug`)
- Full program breakdown
- Project list (accordion: click to expand preview)
- Pricing card with Razorpay checkout integration
- Testimonials carousel
- FAQ accordion
- Sticky CTA bar on mobile

#### Page: Student Dashboard (`/apprenticeship/dashboard`)
- Enrollment summary cards (one per enrolled program)
- Progress rings (SVG, animated) showing percentage complete
- Days remaining countdown
- "On Track" / "Behind" indicator
- Recent XP activity feed
- Quick-access button to current project

#### Page: Project Workspace (`/apprenticeship/projects/:projectId`)
This is the most important page. Design it carefully.

Layout:
- Left sidebar: Project list (current program), locked projects shown with lock icon
- Main content area: Tabbed (Guide / Tests / Community / Resources)
- Right panel: Test results (collapsible on mobile)

Guide Tab:
- Path toggle at top (Traditional / AI-Assisted)
- Traditional: numbered step list with expandable code blocks (Monaco viewer, read-only)
- AI-Assisted: prompt cards with copy-to-clipboard, phase labels, expected outcome chips

Tests Tab:
- Verification requirements panel (checklist of what will be tested)
- "Start Project" button (triggers GitHub repo creation flow if not started)
- After start: Clone command with copy button
- Real-time test result panel:
  - Connection indicator ("Listening for push...")
  - Stage cards (each stage is a row: stage name, status icon, XP badge)
  - Stages animate in as results arrive via Supabase Realtime
  - Passed = green glow. Failed = red with error details collapsed (expand to see)
  - Last 20 lines of console output (monospace, dark background) shown on failure
- Push reminder: "Push to `main` to trigger verification"
- Submission history (collapsible table of all attempts)

#### Page: Certificate (`/apprenticeship/certificates/:code`)
- Public-facing, no auth required
- Certificate rendered as a beautiful HTML/CSS design (not just an image)
- Verification badge with checkmark
- LinkedIn share button (pre-filled post text)
- PDF download button
- "Verify authenticity" section showing verification code and issuer details

### Module B: Admin Dashboard

#### Page: Admin Overview (`/admin/apprenticeship`)
- KPI cards: Total Enrollments, Active, Revenue (INR), Avg Completion Rate, Certificates Issued
- Enrollment trend chart (by month)
- Program performance table (completion rate, revenue, student count per program)
- Struggling students alert panel (enrolled > 14 days, no progress)
- Real-time activity feed (latest submissions, new enrollments, certificate generations)

#### Page: Program Manager (`/admin/apprenticeship/programs`)
- List of all programs with status badges
- "Create Program" modal (all fields)
- Inline edit for price and status
- Per-program: edit button, view student list, view analytics

#### Page: Program Editor (`/admin/apprenticeship/programs/:id/edit`)
- Full program form
- Project sub-list with drag-to-reorder
- Add/remove projects
- Preview mode toggle

#### Page: Project Editor (`/admin/apprenticeship/programs/:id/projects/:projectId/edit`)
- Rich text guide editor for Traditional path (with code block support)
- Prompt list editor for AI-Assisted path
- Test configuration panel (required endpoints, required test count)
- Resources manager
- Save as Draft / Publish toggle

#### Page: Submissions Feed (`/admin/apprenticeship/submissions`)
- Live-updating table (Supabase Realtime)
- Columns: student, program, project, status, attempt #, submitted at, actions
- Status filter tabs: All / Testing / Passed / Failed / Manual Review
- Click row: side panel with full test output, repo link, and manual override controls

#### Page: User Inspector (`/admin/apprenticeship/users/:userId`)
- Profile header: avatar, name, email, join date, GitHub connection status
- Enrollment cards (all programs)
- Submission history per project (accordion)
- Activity timeline:
  - Chronological event log
  - Filter by event category
  - Each event shows type, data, page, timestamp
  - Color-coded by category (navigation=gray, verification=blue, payment=green, admin=red)
- Quick actions: Add XP, Force Unlock, Send Notification, Revoke Enrollment

#### Page: Analytics (`/admin/apprenticeship/analytics`)
- Enrollment funnel (step chart: enrolled → p1 started → p1 passed → p2 started → ... → certified)
- Drop-off heatmap (which project loses the most students)
- AI query topics (word cloud or list of top 20 questions per project)
- Code quality distribution per project (box plot or histogram)
- Leaderboard snapshot

#### Page: Coupon Manager (`/admin/apprenticeship/coupons`)
- CRUD for coupon codes
- Usage stats per code
- Bulk create for campaigns

---

## SECTION 7 — REAL-TIME ARCHITECTURE

Use Supabase Realtime for all live updates. No polling except as fallback.

### Channels

| Channel Name | Who Subscribes | Events Published |
|---|---|---|
| `submission:{submissionId}` | Student browser (current project page) | `status_changed`, `stage_completed`, `xp_awarded` |
| `enrollment:{enrollmentId}` | Student browser (dashboard) | `project_unlocked`, `certificate_issued` |
| `admin:submissions` | Admin submission feed page | `new_submission`, `status_changed` |
| `admin:realtime` | Admin overview page | `new_enrollment`, `new_certificate`, `user_online` |

### Payload Shape
```typescript
{
  type: 'stage_completed',
  data: {
    stageNumber: 2,
    stageName: 'POST /api/auth/signup',
    status: 'passed',
    xpForStage: 20,
    passedTests: 3,
    totalTests: 3
  }
}
```

---

## SECTION 8 — ERROR HANDLING & EDGE CASES

Handle every one of these explicitly:

1. **GitHub token revoked by student**: Detect 401 on API call → show reconnect banner → one-click reauth
2. **Student deletes their repo**: GitHub sends `delete` event → mark project_progress webhook as inactive → show "repo deleted" banner with one-click recreate
3. **Docker container timeout**: App didn't start in 30s → fail submission with "Server did not start — is `npm start` in package.json?"
4. **App crashes on startup**: Stage 1 fails → show last 20 lines of console output in the test panel
5. **Student pushes to wrong branch**: Webhook arrives for non-main branch → silently ignore → show persistent tip "Push to `main` to trigger verification"
6. **Webhook spoofing attempt**: HMAC mismatch → return 401 → log security event
7. **Worker crashes mid-verification**: BullMQ retry with exponential backoff → on 3rd failure, mark as failed and alert admin
8. **Payment webhook duplicate**: Idempotency key prevents double enrollment — check enrollment exists before creating
9. **Program at max capacity**: Return `E_ENROLL_002` with "Program is full" message at checkout step, not at payment step
10. **Student has no Git installed** (any project): The platform detects a missing GitHub connection before "Start Project" is clickable — show an onboarding checklist: (1) Install Git, (2) Connect GitHub. Provide a 5-step internal Git setup guide (do not link to external Git docs — write your own 300-word version).

---

## SECTION 9 — SECURITY REQUIREMENTS

1. All admin routes protected by `requireAdmin` middleware (check `users.role = 'admin'`)
2. All enrollment-specific routes verify that `enrollment.user_id = authenticated user`
3. GitHub access tokens: AES-256 encrypted at rest in the database. Decrypted only server-side, never sent to the client.
4. Webhook signature verification: mandatory, cannot be bypassed
5. Rate limits:
   - General API: 100 req/min
   - Submission trigger (webhook): handled by GitHub's own rate limiting
   - AI Help: 10 req/hour per user (enforced with Redis)
   - Community Posts: 20 req/hour per user
6. Docker test containers must run with `--network none` (no outbound internet during testing) to prevent students from writing code that phones home
7. All student-submitted GitHub URLs must be validated: only `github.com` domain accepted, repo must be accessible with the stored OAuth token

---

## SECTION 10 — ENVIRONMENT VARIABLES REQUIRED

```env
# GitHub OAuth App
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_ORG_NAME=learning-haven          # Your GitHub organization that owns template repos
GITHUB_BOT_TOKEN=                        # A GitHub PAT with repo scope for cloning in workers

# Encryption
GITHUB_TOKEN_ENCRYPTION_KEY=            # 32-byte key for AES-256

# Webhook
WEBHOOK_BASE_URL=https://api.learninghaven.com  # Where GitHub sends push events

# Existing (already in project)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
OPENAI_API_KEY=
RESEND_API_KEY=
SENTRY_DSN=
```

---

## SECTION 11 — IMPLEMENTATION ORDER

Build in this exact sequence. Each phase must be fully functional and tested before moving to the next.

### Phase 1 — Foundation (Week 1)
1. Database migrations (all tables from Section 3)
2. Program CRUD API (admin endpoints)
3. Project CRUD API (admin endpoints)
4. Public program listing and detail endpoints
5. Admin Program Manager UI
6. Admin Project Editor UI (guide content + test config)

### Phase 2 — Enrollment & Payments (Week 2)
7. Razorpay order creation + verification
8. Enrollment creation endpoint
9. Coupon code system
10. Student Dashboard UI
11. Program Detail + Checkout UI
12. Referral code application at enrollment

### Phase 3 — GitHub Integration (Week 3)
13. GitHub OAuth flow (3 endpoints)
14. Repo creation from template
15. Webhook installation
16. Webhook receiver + HMAC verification
17. BullMQ worker (hardcoded pass/fail for now — Docker in Phase 4)
18. Supabase Realtime test result streaming
19. Student Project Workspace UI (Tests tab)

### Phase 4 — Verification Engine (Week 4)
20. Docker integration in worker
21. Stage-by-stage result parsing
22. Code quality scorer
23. Security scanner
24. Test results UI polish (animations, XP toasts)

### Phase 5 — Community & Leaderboard (Week 5)
26. Community posts API
27. Community UI
28. Leaderboard API + UI
29. Certificate generation + PDF
30. Certificate verification public page

### Phase 6 — Admin Monitoring (Week 6)
31. Event logging middleware (auto-logs every request with user/session context)
32. Admin User Inspector (timeline view)
33. Admin Analytics dashboard (funnel, drop-off, AI queries)
34. Admin Submission Feed (real-time)
35. Notification broadcast system
36. Admin Realtime Overview

---

## SECTION 12 — WHAT THIS SYSTEM MUST NOT DO

1. Must NOT ask students to paste a commit hash anywhere
2. Must NOT require students to copy-paste a GitHub repo URL for submission
3. Must NOT block enrollment at the payment step due to program capacity — check capacity BEFORE showing the payment form
4. Must NOT expose admin routes to non-admin users under any circumstance
5. Must NOT run Docker containers with internet access (prevents cheating)
6. Must NOT store GitHub tokens in plaintext
7. Must NOT allow a student to access a locked project's full guide, test suite, or reference solution
8. Must NOT generate a certificate unless all projects have `status = 'passed'`
9. Must NOT allow the same coupon code to be applied twice by the same user
10. Must NOT allow a student to enroll in the same program twice

---

## DELIVERABLES

When you build each component, provide:

1. **Database migration file** (SQL, ready to run in Supabase)
2. **Backend service file** (TypeScript, with full type definitions)
3. **Controller file** (Express routes and handlers)
4. **Frontend page/component** (React + TypeScript + Tailwind)
5. **BullMQ worker file** (for verification)
6. **Environment variable template** (additions to `.env.example`)

For any component you cannot build fully, clearly document what is missing and why, and provide the interface/type definition so it can be implemented by another developer.

---

## FINAL NOTE

This system is the core product differentiator for Learning Haven. It must work flawlessly. A student who pushes correct code and sees a failure is gone forever. A student who pushes code, sees tests running in real time, and watches stages light up green one by one — that student finishes the program, shares their certificate, and refers five friends.

Build this like you are the student who will use it.

---END PROMPT---
