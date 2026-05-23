# Learning Haven Project Analysis Report

Date: 2026-05-22

## Scope

This report covers:

- learner frontend in `src/`
- admin panel in `admin/src/`
- backend and workers in `backend/src/`
- the current "project building" system, especially the CodeCrafters-like flow

It also compares the current implementation with how CodeCrafters works based on:

- https://app.codecrafters.io/concepts/overview
- https://app.codecrafters.io/concepts/codecrafters-git-server-internals
- https://codecrafters.mintlify.app/challenges/how-challenges-work
- https://docs.codecrafters.io/membership/content

## Executive Summary

The project is not starting from zero. You already have a meaningful foundation for a CodeCrafters-like system.

What is clearly already built:

- a public project catalog for build challenges
- a challenge detail page with language selection and stage previews
- a dedicated CodeCrafters-style workspace page
- admin tooling to create build challenges, stages, and language configs
- backend APIs for challenge listing, workspace loading, enrollment, leaderboards, and admin CRUD
- GitHub OAuth and GitHub webhook handling
- BullMQ-based build verification worker
- Docker-based stage verification
- Supabase Realtime-style broadcast refreshes in the workspace

What is only partially built or still fragile:

- schema tracking for the new Build Haven tables is incomplete in tracked migrations
- build challenges are piggybacking on the apprenticeship data model instead of having a fully separate domain
- stage verification is currently tied to "current stage only", with read-only viewing for later stages
- there is no visible local CLI/test shortcut equivalent to the CodeCrafters CLI
- there is no visible per-stage terminal stream in the Git push session itself; the UI refreshes after webhook/worker events
- access control, monetization, unlocking rules, and analytics for build challenges are still thinner than the apprenticeship system

Bottom line:

- the frontend/admin/backend skeleton for a CodeCrafters-like system exists
- the Build Haven feature is real, not mock-only
- the apprenticeship system is still the more mature and complete project engine
- Build Haven looks like the newer, more focused attempt to create the CodeCrafters-like experience

## How CodeCrafters Works

From the referenced CodeCrafters docs:

- each challenge is broken into stages
- a user gets a repository created for them during setup
- the user works locally in their own editor and terminal
- `git push` triggers tests remotely
- the current stage is the one being verified
- after passing a stage, the next stage unlocks
- stage instructions are intentionally concise, with official docs, hints, and examples
- the backend uses Git server hooks to react to pushes and then schedules remote test runs

The key product behaviors to copy are:

1. per-user repo provisioning
2. stage-by-stage unlocking
3. current-stage-only verification
4. fast feedback loop after push
5. hints/examples/docs attached to each stage
6. clear progress state in the UI
7. challenge authoring tools for stages and language templates

## Current Repo Structure

There are three main apps plus an apprenticeship schema slice:

- `src/`: learner-facing frontend
- `admin/src/`: admin panel
- `backend/src/`: API, queue workers, GitHub integration
- `apprenticeship-platform/`: SQL schema for the older apprenticeship system

The main routing already exposes both the apprenticeship project flow and the newer build challenge flow:

- `src/App.tsx`
- build challenge routes: `/projects`, `/projects/:slug`, `/projects/:slug/workspace`
- apprenticeship routes: `/jobs/apprenticeships/:slug`, `/apprenticeship/projects/:projectId`

This means the repo currently contains two related project systems:

1. Apprenticeship projects
2. Build Haven build challenges

## Frontend Analysis

### What is already built

The learner frontend already contains a dedicated Build Haven flow:

- `ProjectsPage` presents a project catalog with CodeCrafters-style positioning around staged project building and Git push verification.
- `BuildChallengePage` lets the user inspect a challenge, review stages, choose a language, connect GitHub, and start the challenge.
- `BuildWorkspacePage` is the strongest signal that the product is already moving toward a CodeCrafters-like UX.

Important implemented behaviors:

- catalog fetches live build challenges from `/v1/build/challenges`
- challenge page reads stage metadata and language templates
- workspace shows a left stage stepper, central instructions, hints, examples, docs tab, bottom test strip, and leaderboard
- workspace listens for realtime events and refreshes on verification updates
- workspace clearly treats only the current stage as the active verification target

Key references:

- `src/pages/ProjectsPage.tsx`
- `src/pages/BuildChallengePage.tsx`
- `src/pages/BuildWorkspacePage.tsx`
- `src/services/build-haven.service.ts`

### What the frontend does well

- good separation between catalog, challenge detail, and workspace
- language-specific setup is supported
- stage progression UI already exists
- hints and code examples are already part of the stage model
- Git instructions are explicit for clone and push
- leaderboard is already attached to the challenge experience

### Frontend gaps vs a full CodeCrafters clone

- no visible streamed terminal output directly during push; feedback is shown after the worker persists results
- no local fast-run command or CLI path similar to `codecrafters test`
- no visible "locked but readable" membership gating equivalent for build challenge access
- no visible concept of stage discussion, community hints, or screencasts inside Build Haven
- no visible setup guardrails for repo-not-created, GitHub-not-connected, or wrong-branch mistakes beyond basic actions
- no visible "resume exactly where you left off" dashboard for Build Haven, beyond workspace state itself

### Apprenticeship frontend overlap

The older apprenticeship workspace is more feature-rich in some areas:

- test stage history
- community posts and replies
- AI help
- project progression inside a paid/enrolled program

Key references:

- `src/pages/WorkspacePage.tsx`
- `src/pages/ApprenticeshipEnrollmentPage.tsx`
- `src/services/apprenticeship.service.ts`

Interpretation:

Build Haven has the cleaner CodeCrafters-style UX, while Apprenticeship has the broader learning ecosystem features.

## Admin Panel Analysis

### What is already built

The admin panel already has an operational Build Challenges area:

- list/query build challenges
- create and update challenge metadata
- manage stage records
- reorder stages using drag-and-drop
- configure stage instructions, hints, code examples, docs, test command, Docker image, timeout, expected exit code, and success criteria JSON
- configure language-specific starter repos and Docker images

Key references:

- `admin/src/pages/apprenticeship/BuildChallengesPage.tsx`
- `admin/src/services/build-haven.service.ts`
- `admin/src/components/Sidebar.tsx`

This is a strong sign that the content authoring side for a CodeCrafters-like system is already underway.

### What the admin panel does well

- challenge authoring is centralized
- stage ordering is editable
- language templates are first-class
- stage verification config is authorable without backend code edits
- markdown preview support exists

### Admin gaps

- no clear "publish readiness" checklist for a challenge
- no visible preview for the exact learner workspace flow before publish
- no visible per-stage attempt analytics specific to Build Haven
- no visible tooling for cloning/validating starter repos before publish
- no visible management for access rules such as free stages, premium stages, beta rollout, or cohort-based release
- no visible test-run sandbox validation from admin itself

### Apprenticeship admin overlap

The apprenticeship admin area is broader and more mature:

- programs
- project editors
- submissions
- students
- analytics
- coupons
- notifications

Key references:

- `admin/src/pages/apprenticeship/ProgramsPage.tsx`
- `admin/src/pages/apprenticeship/ProjectEditorPage.tsx`
- `admin/src/services/apprenticeship.service.ts`

Interpretation:

Build Haven admin is specialized and useful, but apprenticeship admin still has deeper operational coverage.

## Backend Analysis

### What is already built

The backend Build Haven stack is substantial.

Implemented pieces:

- public and authenticated build challenge routes
- admin CRUD routes for challenges, stages, and languages
- challenge data stored through `BuildHavenService`
- per-user challenge start flow
- GitHub repo provisioning from a starter template
- GitHub webhook verification trigger
- BullMQ job queue for build verification
- Dockerized test execution
- stage completion persistence
- enrollment progress updates
- leaderboard generation

Key references:

- `backend/src/modules/build-haven/routes.ts`
- `backend/src/modules/build-haven/controller.ts`
- `backend/src/modules/build-haven/service.ts`
- `backend/src/workers/build-verification.worker.ts`
- `backend/src/modules/github/github.controller.ts`
- `backend/src/modules/github/github.service.ts`

### Backend flow for Build Haven

Current build challenge flow appears to be:

1. user picks a challenge and language
2. `startChallenge()` provisions a GitHub repo from a template
3. enrollment is stored in `build_enrollments`
4. user clones locally and pushes to `main`
5. GitHub webhook hits backend
6. backend identifies whether the repo belongs to Build Haven or Apprenticeship
7. Build Haven push enqueues `build-verification`
8. worker resolves the user’s current stage
9. worker clones the pushed repo and checks out the commit
10. worker runs Docker with the configured test command
11. result is stored in `build_stage_results`
12. if passed, current stage is marked complete and next stage is unlocked
13. realtime broadcast causes workspace refresh

That is very close to the core CodeCrafters loop.

### What the backend does well

- verification is asynchronous and queue-based
- verification uses Docker isolation
- success criteria can be richer than exit code alone
- stage completion logic updates progression automatically
- webhook receiver supports both apprenticeship and build challenge repos
- current stage resolution enforces sequential progression

### Backend gaps and risks

1. Build Haven schema tracking is incomplete in repo-owned migrations.

The tracked migration set includes apprenticeship schema SQL and a small Build Haven alter migration, but there is no full tracked migration defining:

- `build_enrollments`
- `build_stages`
- `build_stage_results`
- `build_challenge_languages`

That means local environment reproducibility is not yet trustworthy from migrations alone.

2. Build Haven is partially modeled inside apprenticeship tables.

Build challenges are stored in `apprenticeship_programs` with `program_type = 'build_challenge'`. This is pragmatic, but it means the domain is still hybrid rather than cleanly separated.

3. GitHub setup is a hard dependency.

There is no alternate submission path for users who cannot or do not want to use GitHub, unlike CodeCrafters' later CLI evolution.

4. Verification feedback is persisted and rebroadcast, but not obviously streamed line-by-line to the learner UI.

CodeCrafters emphasizes the push-time feedback loop. Your current system appears event-based and near-realtime, but not terminal-stream-native.

5. Build challenge analytics and anti-abuse controls are still thinner than apprenticeship.

The apprenticeship module already has event tracking, submissions, review states, certificates, and richer analytics. Build Haven currently looks narrower.

## Database and Schema Analysis

The apprenticeship schema is properly represented in:

- `apprenticeship-platform/supabase/migrations/20260428_apprenticeship_platform.sql`

That migration defines:

- programs
- projects
- enrollments
- project progress
- submissions
- test stages
- GitHub connections
- posts/replies/upvotes
- certificates
- events
- coupons

Build Haven, however, only has a small additive migration in tracked backend migrations:

- `backend/supabase/migrations/20260511000001_build_haven_stage_columns.sql`

Assessment:

- apprenticeship schema maturity: high
- Build Haven schema maturity in tracked migrations: low to medium

This is one of the most important technical gaps for production confidence.

## Special Analysis: Project Section / CodeCrafters-Like System

### What is already built for the project section

The CodeCrafters-like "project section" already has these real parts:

- project catalog
- challenge detail page
- language selection
- GitHub connect flow
- repo provisioning from a template repo
- stage model
- current-stage-only progression model
- per-stage instructions
- hints
- code examples
- concept/docs links
- leaderboard
- webhook-triggered verification
- Docker-based checking
- automatic unlock of next stage after pass

This is enough to say the project section is already materially built.

### What is still missing before it feels truly like CodeCrafters

1. Stronger submission feedback loop

- terminal-style streamed logs during verification
- explicit run states like queued, cloning, booting runner, stage running, final verdict
- better failure categorization

2. Better challenge lifecycle

- draft to beta to live workflow with validation
- starter repo health checks
- challenge publish checklist
- stage completeness validation

3. Better learner continuity

- "my active builds" dashboard
- challenge continue CTA from dashboard/profile
- attempt history beyond the last summary strip
- explicit "next step" prompts after failure

4. Better monetization/access control

- free stages / paid stages policy
- challenge-specific unlock rules
- membership gating similar to CodeCrafters content access

5. Better observability

- build-specific analytics tables and dashboards
- pass/fail rate per stage
- time-to-pass per stage
- dropout point tracking

6. Better local developer workflow

- CLI or helper command to test locally before push
- challenge author test harness
- starter repo validation script

### Strategic conclusion

If the goal is "make a CodeCrafters-like system in my site", the fastest path is not to replace the existing system. The fastest path is:

1. keep Build Haven as the focused CodeCrafters-style layer
2. borrow mature pieces from Apprenticeship where needed
3. stop mixing schema ownership across untracked migrations
4. deepen the Build Haven feedback loop and progress analytics

## Clear Status By Area

### Frontend

Status: partially to strongly built

Already built:

- project catalog
- project details
- build workspace
- stage navigation
- hints/examples/docs
- leaderboard
- realtime refresh

Missing:

- streamed runner UX
- stronger progress dashboard
- local test helper flow
- richer recovery/error UX

### Admin Panel

Status: strongly built for authoring, weaker for operations

Already built:

- challenge CRUD
- stage CRUD
- stage ordering
- language config
- verification config

Missing:

- publish validation
- build analytics
- challenge QA flow
- challenge preview parity checks

### Backend

Status: strongly built for core loop, still incomplete for platform hardening

Already built:

- APIs
- GitHub auth
- repo provisioning
- webhooks
- queue worker
- Docker verification
- progression persistence
- leaderboards

Missing or risky:

- complete tracked schema
- richer telemetry
- richer access rules
- CLI/local helper path
- more explicit streaming feedback model

## Recommended Next Steps

### Phase 1: stabilize what already exists

- add full SQL migrations for all Build Haven tables
- document required env vars for GitHub, Redis, Docker, Supabase
- verify webhook signatures and raw body behavior end-to-end in one integration test
- add seed data for one golden build challenge

### Phase 2: make the learner experience feel like CodeCrafters

- add build queue states and terminal-style live output
- add "my builds" dashboard with continue buttons
- show stage-by-stage attempt history
- improve failure guidance and hint progression

### Phase 3: make authoring production-safe

- add admin publish checklist
- add starter repo verification
- add test image validation
- add stage coverage checks

### Phase 4: productize

- add free-stage vs paid-stage access policy
- add challenge analytics
- add challenge ranking and completion stats
- add optional local CLI/helper

## Final Verdict

Your site already contains the backbone of a CodeCrafters-like project system.

The most important insight is this:

- Apprenticeship is the mature "program and submission platform"
- Build Haven is the newer "CodeCrafters-style staged build system"

So the correct framing is not "we need to start building it".

The correct framing is:

"We already built a meaningful first version. Now we need to harden schema ownership, improve verification UX, and turn Build Haven into the primary polished project-building product."
