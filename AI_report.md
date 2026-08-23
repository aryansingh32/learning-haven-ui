# Build Haven: Dual-Mode (Traditional + Vibe-Coded) Verification Platform
### A code-grounded audit of `learning-haven-ui` and an implementation plan for a "Build → Prove → Ship" system

Prepared for: Sir (Harsh Dubey)
Repo audited: `github.com/aryansingh32/learning-haven-ui` (cloned and read directly, not assumed)
Scope: `apps/api/src/modules/build-haven`, `apps/api/src/modules/github`, `apps/api/src/modules/execution`, `apps/web/src/pages/Build*`, `apps/web/src/features/build-haven`, `apps/admin/src/pages/apprenticeship/BuildChallengesPage.tsx`, `apps/admin/src/pages/build-haven`, `apps/api/supabase/migrations/*build*`, entitlements/billing modules.

---

## 0. TL;DR

You already built ~80% of the hard infrastructure needed for this. What you're missing is not a rewrite — it's **one new dimension in the data model** (`mode: traditional | vibe`), **one new stage type** (proof-gate/acceptance-contract instead of docker-test-against-a-git-commit), and **one new sandbox capability** (build-and-serve-then-browser-test, not just run-a-test-command). Everything else — GitHub OAuth, template-repo provisioning, webhook → BullMQ queue, Docker isolation, admin CRUD with drag-drop stage ordering, entitlements/Razorpay gating, AI provider abstraction (Anthropic + OpenAI + OpenRouter already wired) — is reusable almost as-is.

The "breakthrough" isn't a new AI judge. It's this: **your `apprenticeship_programs` table is already a single unified catalog with a `program_type` discriminator (`'apprenticeship' | 'build_challenge'`)**. Adding `'vibe_challenge'` (or, better, an `available_modes text[]` column so *one project* can offer *both* modes) is a two-line migration, not a new product.

---

## 1. What's actually in the codebase today (verified by reading the files)

### 1.1 Data model — `apprenticeship_programs` is already the unified catalog

`apps/api/supabase/migrations/20260520000001_build_haven_complete.sql` shows the whole system was deliberately built as an **extension of one table**, not a parallel one:

```sql
alter table public.apprenticeship_programs
  add column if not exists program_type text default 'apprenticeship';
-- comment: 'Discriminator: apprenticeship | build_challenge'
```

Then four child tables hang off it:

- `build_stages` — `program_id`, `stage_number`, `difficulty`, `instructions`, `code_example`, `hints[]`, **`test_command`**, **`docker_test_image`**, `timeout_seconds`, `expected_exit_code`, `success_criteria jsonb`, `sort_order`.
- `build_enrollments` — `user_id`, `program_id`, `language`, `current_stage`, `completed_stages int[]`, `total_stages`, `progress_percentage`, `repo_full_name`, `repo_url`, `webhook_secret`, `status`.
- `build_stage_results` — `enrollment_id`, `stage_id`, `commit_hash`, `status`, `test_output`, `exit_code`, `execution_time_ms`, `attempt_number`, **`structured_feedback jsonb`**.
- `build_challenge_languages` — `program_id`, `language`, `starter_repo_url`, `docker_test_image`, `setup_instructions`.

This is already, structurally, a CodeCrafters clone: **stage = a test command run in a container against a specific git commit.** Good news: `structured_feedback jsonb` and `success_criteria jsonb` are schemaless-enough that a new verification style can slot into the *same columns* without a new table for the common case.

### 1.2 The full traditional loop is implemented end-to-end

`apps/api/src/modules/build-haven/service.ts` (1,229 lines) implements the complete CodeCrafters loop:

- `startChallenge()` → calls `GitHubService.provisionRepository()`.
- `GitHubService.provisionRepository()` (`apps/api/src/modules/github/github.service.ts`) does real work: verifies the starter repo `is_template`, calls `octokit.rest.repos.createUsingTemplate`, creates a **push webhook** pointed at `${WEBHOOK_BASE_URL}/api/v1/build/webhooks/github`, encrypts and stores the user's GitHub token (AES-256-CBC), and has real retry/edge-case handling (rate limits, "repo already exists" recovery, 404s with actionable admin-facing error messages).
- Webhook lands in `GitHubController.webhookReceiver` → emits a domain event (`github.push_received`) on an **EventBus** → `apps/api/src/modules/execution/services/verification.service.ts` subscribes and enqueues a job on a **BullMQ** queue (`build-verification`, backed by `ioredis`).
- The worker eventually calls `runStageVerification()`, which:
  1. `git clone --depth=1` the user's repo into `/tmp/verify-build/<stageId>-<ts>`, checks out the exact commit.
  2. Applies **template-variable randomization** to the test command (`applyRandomization()` — supports `random_choice`, `random_int`, `random_string`) — this is a genuinely good anti-cheating feature already built, mirroring CodeCrafters' "randomized template variables" pattern.
  3. Runs `runDockerInWorkspace()` — spawns `docker run --rm --network none --memory 512m --cpus 0.5 -v workdir:/workspace:ro <image> sh -lc "<command>"`, with a hard timeout, live line-by-line log streaming via `onLogLine`, and SIGKILL + `docker kill` cleanup on timeout.
  4. Compares exit code + `success_criteria.output_contains` / `output_regex` → produces a `structured_feedback` object with `verdict`, `exit_code_match`, `criteria_ok`, `logs_tail`, `suggested_hint`.
- `completeStage()` writes the attempt to `build_stage_results`, advances `current_stage`, recomputes `progress_percentage`, flips `status` to `completed` when `nextStage > total_stages`.

**This is a real, working, isolated, queued, webhook-driven verification pipeline — not a mock.** The container isolation (`--network none`, memory/CPU caps, timeout + force-kill) is already production-shaped.

### 1.3 Admin panel already supports full CRUD + monitoring

- `apps/admin/src/pages/apprenticeship/BuildChallengesPage.tsx` (947 lines): tabs = `overview | stages | languages | preview | analytics`, drag-and-drop stage reordering (`@dnd-kit`), markdown preview component, per-language starter-repo config.
- `apps/admin/src/pages/build-haven/BuildChallengeUsersPage.tsx` (501 lines): per-challenge enrollment monitoring.
- `BuildHavenService.adminManualPassStage()` — admin override to manually pass a stuck stage (important escape hatch you already thought of).
- `BuildHavenService.getAnalytics()` — challenge-level analytics already exists.

### 1.4 Web frontend already has the CodeCrafters-style UX

- `BuildCatalogPage.tsx` → `BuildChallengePage.tsx` (590 lines, difficulty bars styled explicitly "CodeCrafters style" in a code comment, language picker, recent-attempts leaderboard sidebar, GitHub OAuth connect flow) → `BuildWorkspacePage.tsx` (703 lines: `BuildStageSidebar`, `BuildTestRunner` with **live streamed logs**, `BuildRepoSetup`, `StagePassModal`, `BuildWorkspaceTopBar`).
- `BuildTestRunner.tsx` already renders a live-updating log stream from a running verification job — this is your "verification timeline" UI primitive, already built, just needs a second data shape to render (gate-based instead of single-command-based).

### 1.5 Monetization & AI infra already wired, not hypothetical

- `apps/api/package.json` dependencies confirm: `razorpay ^2.9.6` (Indian payments, already integrated per your other product work), `@anthropic-ai/sdk ^0.98.0`, `openai ^6.22.0`, `bullmq ^5.69.2`, `ioredis ^5.9.3`, `@octokit/rest` + `@octokit/webhooks`.
- `apps/api/src/modules/entitlements/` — `access.service.ts`, `entitlements.middleware.ts`, `entitlements.repository.ts`. The route `POST /challenges/:slug/start` is already gated by `requireEntitlement('challenge_limit')` in `build-haven/routes.ts`. This is your existing pattern for "free tier has N challenge starts/month" — the exact mechanism you'll reuse for "free tier has N AI-repair credits/month."
- `apps/api/src/modules/execution/services/ai.service.ts` + `ai-provider.service.ts` — a working multi-provider AI abstraction (OpenRouter/OpenAI/Anthropic, configurable per `system_settings` table, with per-plan rate limits `PLAN_LIMITS`). Today it's used for an **AI coach chat**, not code generation or visual judging — but the plumbing (provider switching, streaming, rate limiting, usage logging to `ai_chats`) is the exact plumbing you need for "AI Judge" and "AI Repair."

### 1.6 What is genuinely missing (the real gap, not a guess)

| Gap | Evidence |
|---|---|
| No `mode`/`program_type` value for vibe/prompt-based challenges | Only `'apprenticeship'` and `'build_challenge'` exist anywhere in the codebase (`grep` confirmed) |
| No concept of "run and serve an app," only "run a test command against a checked-out commit" | `runDockerInWorkspace()` mounts the repo **read-only** (`:ro`) and runs one shell command to completion — it does not start a long-lived server and hit it from outside |
| No browser automation anywhere | No `playwright`, `puppeteer`, or similar in `apps/api/package.json` dependencies |
| No "acceptance contract" / user-journey schema | `success_criteria jsonb` today only supports `output_contains` / `output_regex` / `next_hint_on_fail` — flat key checks, not step sequences |
| No visual/screenshot verification | Nothing in `execution/` touches images beyond `ai-provider.service.ts` being provider-agnostic (could carry image payloads, but nothing calls it that way today) |
| No non-GitHub submission path | `startChallenge()` hard-requires a GitHub template repo + OAuth; a vibe-coded submission (paste a live URL, or "I built this with Claude Code/Lovable/Cursor locally") has no path in |
| No mode picker UI | `BuildChallengePage.tsx` goes straight from language picker to `startChallenge` — no branch point for "how do you want to build this" |

This gap list is small and additive. Nothing above requires touching the existing traditional pipeline, which should **not** be rewritten — it works, it's tested by your own README/DEBUGGING docs, and CodeCrafters-style learners will keep using it.

---

## 2. The core design decision

Do not build "Build Haven" and "Vibe Haven" as two products. Build **one catalog, two verification strategies, admin-controlled per project.**

### 2.1 Data model changes (additive migrations only)

```sql
-- Migration: 20260820000001_dual_mode_challenges.sql

-- 1. Which modes a given project supports, and which is the default
alter table public.apprenticeship_programs
  add column if not exists available_modes text[] not null default '{traditional}';
  -- values: 'traditional' | 'vibe'  — a project can list both

alter table public.apprenticeship_programs
  add column if not exists default_mode text not null default 'traditional';

-- 2. Stage-level verification strategy (this is the real fork)
alter table public.build_stages
  add column if not exists verification_type text not null default 'docker_test'
    check (verification_type in ('docker_test', 'contract'));

-- 'docker_test'  -> existing behavior, untouched (runStageVerification as-is)
-- 'contract'     -> new behavior: acceptance-contract / proof-gate verification

alter table public.build_stages
  add column if not exists acceptance_contract jsonb not null default '{}'::jsonb;
  -- houses: { journeys: [...], api_checks: [...], visual_checks: [...] }
  -- reuses the exact jsonb pattern success_criteria already established

-- 3. Which mode a given enrollment picked
alter table public.build_enrollments
  add column if not exists build_mode text not null default 'traditional'
    check (build_mode in ('traditional', 'vibe'));

-- 4. Vibe submissions don't necessarily have a GitHub commit_hash from a webhook —
--    they can be a pasted deployment URL, an uploaded zip, or a repo without a webhook.
alter table public.build_stage_results
  add column if not exists submission_source text
    check (submission_source in ('github_push', 'live_url', 'zip_upload', 'sandbox_build'));

alter table public.build_stage_results
  add column if not exists submission_ref text; -- URL, or storage path
```

Why this shape and not two parallel tables:

- **`structured_feedback jsonb`** on `build_stage_results` already exists and is already rendered generically by `BuildTestRunner.tsx`/admin monitoring. A `contract`-verified stage just writes a *richer* `structured_feedback` (per-journey pass/fail array instead of one exit-code check) — the storage and monitoring layers need zero schema change, only a rendering branch.
- **`success_criteria` → `acceptance_contract`** is the same idea CodeCrafters already gave you (`success_criteria.output_contains`), extended from "one flat check" to "an ordered list of checks" — a superset, not a redesign.
- Reusing `apprenticeship_programs` + `build_stages` + `build_enrollments` means the **admin CRUD, drag-drop stage ordering, analytics, entitlements gating, and leaderboard all keep working for vibe challenges automatically**, because they all key off `program_id` and don't care what `verification_type` a stage has.

### 2.2 What a "stage" means in each mode

| | Traditional (existing) | Vibe (new) |
|---|---|---|
| Unit of progress | Stage = one git commit that must make one shell command pass | Gate = one proof of a user journey (a subset of the product's requirements) |
| Trigger | GitHub webhook push | Explicit "Submit for Verification" (repo push, live URL, or sandbox build) |
| Verifier | `docker run <test-image> <test_command>`, exit-code + regex | Build the app → serve it in an isolated container → Playwright walks the journey → structured pass/fail + evidence |
| Escape hatch for stuck learners | `adminManualPassStage()` (exists today) | Same function, reused as-is |
| What the learner writes | Code, commit by commit | Anything — a single AI prompt is fine. The gate doesn't care how the code was produced |

This is exactly the shift both of your pasted research documents converge on: **"we don't judge how you built it, we verify what you built."** Your traditional track already proves *how you built it, incrementally*. The vibe track proves *what got built, holistically*, using stages relabeled as "proof gates" — same UI shell (`BuildStageSidebar`, `StagePassModal`), different meaning.

---

## 3. The mode picker (exactly what you asked for)

On `BuildChallengePage.tsx`, right before the current "Start Challenge" action:

- If `program.available_modes.length === 1` → skip the picker, proceed with that mode automatically (your explicit requirement: "if they are available or default one proceed").
- If both are available → render two cards:

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  🛠  Traditional             │   │  ⚡  Vibe Coded              │
│  Build it stage-by-stage,    │   │  Describe it, build it with  │
│  commit by commit.           │   │  Claude/Cursor/Lovable/etc,  │
│  GitHub required.            │   │  submit — we prove it works. │
│  Best for: learning the      │   │  Best for: shipping fast &   │
│  fundamentals.               │   │  learning to direct + verify │
│                               │   │  AI output.                  │
│  [ Start Traditional ]       │   │  [ Start Vibe Coded ]        │
└─────────────────────────────┘   └─────────────────────────────┘
```

Implementation note: this is a **new component** (`BuildModePicker.tsx`) inserted into the existing page, not a rewrite. `startChallenge` API call gains one field: `build_mode`. `BuildHavenService.startChallenge()` branches on it — traditional path is untouched; vibe path skips `GitHubService.provisionRepository()` (repo becomes *optional*, not mandatory) and instead creates a `build_enrollments` row with `build_mode = 'vibe'`, `repo_full_name = null` allowed.

---

## 4. The vibe-mode verification engine (the new build)

### 4.1 Why you cannot reuse `runDockerInWorkspace()` unmodified

It was built for one job: **run a finite command against a read-only checkout and capture its exit code.** Vibe mode needs a different job: **build a project, start a long-lived server, and have something else (a browser) talk to it while it's running.** That's `docker run` semantics for a *service*, not a *test runner*. You need a sibling process, not a single container.

### 4.2 Proposed new module: `apps/api/src/modules/execution/services/sandbox.service.ts`

Generalize the existing primitives (`runProcess`, container spawn pattern) into a two-container pattern per verification run:

```
1. Receive submission
   - github_push  → git clone the branch/commit (reuse existing clone logic verbatim)
   - live_url     → skip build entirely, treat the URL as the target
   - zip_upload   → unzip into workdir
   - sandbox_build→ (future) code arrived from an in-browser/agent session

2. If build is needed:
   docker run --rm --network build-net --name app-<runId> \
     --memory 1g --cpus 1 -v workdir:/app -w /app <base-image-for-detected-stack> \
     sh -lc "npm ci --no-audit --no-fund && npm run build --if-present && npm run start &
              wait-on http://localhost:$PORT"
   (network is a private docker bridge network, NOT --network none — this container
    needs to be reachable by the test-runner container, but NOT the public internet
    once dependencies are installed. See §6 on the network/security tradeoff.)

3. Playwright runner container on the SAME docker network hits the app container
   by its docker-network alias (not localhost, not public IP):
   docker run --rm --network build-net --name qa-<runId> \
     mcr.microsoft.com/playwright:v1.5x-noble \
     node run-journey.js --target=http://app-<runId>:$PORT --spec=<journeyJson>

4. Playwright script (generated from acceptance_contract.journeys, see §4.3)
   emits structured JSON to stdout — reuse the EXISTING onLogLine streaming
   pattern from runDockerInWorkspace so BuildTestRunner.tsx keeps working
   with zero frontend changes to the log-streaming mechanism.

5. Teardown: docker kill/rm both containers (same pattern as the existing
   timeout handler in runDockerInWorkspace — copy, don't reinvent).
```

This reuses: the child_process spawn pattern, the timeout+SIGKILL+`docker kill` cleanup, the `onLogLine` streaming callback, and the `/tmp/verify-*` workdir lifecycle — all copy-pasted and adapted from code that already exists and already works in `build-haven/service.ts`. It is genuinely ~30% new code, ~70% pattern reuse.

### 4.3 The acceptance contract schema (extends `success_criteria`, doesn't replace the pattern)

```json
{
  "journeys": [
    {
      "id": "create_task",
      "label": "Create a task",
      "steps": [
        { "action": "goto", "path": "/" },
        { "action": "click", "selector": "[data-testid=add-task]" },
        { "action": "fill", "selector": "[data-testid=task-title]", "value": "Learn Spring Boot" },
        { "action": "click", "selector": "[data-testid=save-task]" },
        { "action": "expect_visible", "selector": "text=Learn Spring Boot" }
      ]
    },
    {
      "id": "persist_after_refresh",
      "label": "Task survives reload",
      "steps": [
        { "action": "reload" },
        { "action": "expect_visible", "selector": "text=Learn Spring Boot" }
      ]
    }
  ],
  "api_checks": [
    { "method": "GET", "path": "/api/tasks", "expect_status": 200, "expect_json_contains": { "length_gte": 1 } }
  ],
  "visual_checks": [
    { "id": "mobile_no_overflow", "viewport": "375x812", "assert": "no_horizontal_scroll" }
  ]
}
```

Important product decision, directly answering the "hidden vs public requirements" pattern from your research: store **`journeys` (public, shown to learner as the spec)** separately from an **`admin_only: true` flag per step** for genuinely hidden edge-case checks — so a learner sees *what* must work but not the exact selectors/assertions used to grade it, same spirit as CodeCrafters' public-instructions-vs-hidden-tests split, and directly reusable in the same `admin_only` boolean pattern you already use elsewhere (`is_active` flags exist throughout your schema).

`data-testid` selectors are the pragmatic choice over CSS/text selectors: they survive a wide range of AI-generated implementations (React, Vue, plain HTML) as long as the **product brief tells the builder which testids are required** — this is your "Product Contract," made literally machine-checkable, and it sidesteps needing computer-vision for 90% of functional checks.

### 4.4 Where AI actually enters (and where it deliberately doesn't)

Three tiers, matching what your research correctly identified as the economically sane design — and it maps cleanly onto infra you already have:

1. **Deterministic (free, no AI)** — Playwright steps above. Reuses `AIProviderService`'s pattern of "one abstraction, swappable backend" for *nothing here*; this tier has zero AI cost.
2. **AI Judge (cheap, escalation-only)** — only fires when a `visual_checks` entry can't be resolved deterministically (e.g., "does this look like a dashboard with a sidebar" instead of a hard DOM assertion). Implement as one more method on the **existing** `AIProviderService` (`apps/api/src/modules/execution/services/ai-provider.service.ts`) — it already abstracts OpenAI/Anthropic/OpenRouter and reads model config from `system_settings`, so route this to a cheap vision-capable model (e.g., a Haiku-class or Gemini Flash-class model) via the same config table pattern used for `ai_active_provider`/`ai_model`. No new provider plumbing needed.
3. **AI Repair (paid, premium)** — only triggered by explicit user action ("Fix with AI"), receives the *specific* failing gate's evidence (the failing journey's step, screenshot, console/log tail — exactly the shape `structured_feedback` already stores), not the whole app. Gate this behind the **existing** `entitlements` system: add one new entitlement key (e.g. `ai_repair_credits`) alongside the existing `challenge_limit`, using the same `requireEntitlement()` middleware already wired into `build-haven/routes.ts`. This is a one-line route addition, not new infrastructure.

---

## 5. Admin panel plan (extends `BuildChallengesPage.tsx`, doesn't replace it)

Current tabs: `overview | stages | languages | preview | analytics`. Add:

- **`overview` tab** gains an "Available Modes" multi-select (`Traditional`, `Vibe Coded`) writing to `available_modes`, plus a "Default Mode" radio — this is the field that drives §3's picker logic.
- **`stages` tab**: the existing `SortableStageRow` + drag-drop stays completely as-is for traditional stages. For a `contract`-type stage, the stage editor form swaps `test_command` / `docker_test_image` inputs for a **Journey Builder**: an ordered list of `{action, selector, value}` rows (this is a small, self-contained React form component — same complexity class as the existing hint-list editor you already have for `hints[]`). A toggle per step: "Public requirement" vs "Hidden check."
- **New `reference` tab** (only shown when `vibe` mode enabled): upload/link a "Golden Build" — the canonical reference implementation's live URL or repo. This powers the "Live Reference Demo" the learner can click through (from your research: "the reference app becomes extremely important"). Storing this is trivial (one URL field); *serving* it is just deploying your own reference build once per challenge, which you'd want to build anyway to author the journeys correctly.
- **`BuildChallengeUsersPage.tsx` (monitoring)** needs one addition: when `build_mode = 'vibe'`, render the `structured_feedback` as a **gate checklist with expandable evidence** (matching the "why did I get 93?" UI from your research) instead of the current single pass/fail row — this is a rendering branch on data that's already being stored, not a new data pipeline.

---

## 6. Security & cost reality check (the honest gap between your pasted research and your actual infra)

Your research documents (correctly) assume either (a) third-party sandbox providers like E2B/Daytona, or (b) client-side WebContainers running in the learner's own browser for near-zero marginal cost. **Your actual codebase runs verification on your own server via the local Docker CLI** (`spawn('docker', [...])` — confirmed in `service.ts`). That changes the cost/security model in ways worth being explicit about before you build:

1. **Compute is yours, not free.** Every vibe-mode "build + serve + Playwright-test" cycle costs real CPU/RAM/time on your infrastructure — unlike the traditional mode's short-lived test-command runs. Concrete mitigation: reuse **BullMQ** (already installed) to queue and rate-limit sandbox jobs per user/challenge, exactly like the existing `build-verification` queue does for webhooks; add a hard concurrency cap (e.g., N parallel sandbox jobs server-wide) so a spike in vibe submissions can't take down the traditional pipeline sharing the same box.
2. **Network isolation gets harder, not easier.** The traditional runner uses `--network none` because it only needs to execute a self-contained test command against already-checked-out code — no network required. Vibe mode's build step (`npm install`) *needs* outbound network to fetch packages, but the *running app* should not have open internet access once serving, both for security (arbitrary AI-generated code) and to force determinism (the app shouldn't be able to phone home to hardcode a "correct" response). Two-phase network policy: build with an allow-listed registry mirror (or pre-baked images with common frameworks pre-installed, à la CodeCrafters' `docker_test_image` per language), then re-launch on a `--network none`-equivalent internal bridge that only the sibling Playwright container can reach.
3. **Resource limits must be stricter for arbitrary AI-generated code than for a fixed test command**, since you don't control what the container does (infinite loops, fork bombs, huge `node_modules`). The existing `--memory 512m --cpus 0.5` caps are a reasonable floor; vibe-mode builds likely need a slightly higher budget for `npm install` (e.g., `1g`/`1 cpu`) but the same non-negotiable wall-clock timeout + `docker kill` pattern already implemented should be inherited unchanged.
4. **Start narrow on the tech stack**, exactly as your research concluded, but for infra reasons specific to *your* setup, not aesthetic ones: your `build_challenge_languages` table already models "one config per supported language" per challenge — reuse that mechanism to launch with **Node/React/Next only** for vibe mode v1 (one base Docker image, one Playwright flow), and add Python/Java/etc. later the same way `docker_test_image` already varies per language in the traditional track.

None of this blocks shipping v1 — it just means v1's vibe mode should launch with a **hard cap on concurrent sandbox runs and a single supported stack**, not the "any language, unlimited concurrency" version.

---

## 7. Monetization — reusing what's already live, not inventing pricing

You already have `price_inr` / `original_price_inr` on `apprenticeship_programs`, Razorpay wired in `billing/`, and `requireEntitlement('challenge_limit')` gating challenge starts. Recommended split, mapped to concrete entitlement keys:

| Tier | What it includes | Implementation |
|---|---|---|
| Free | Full deterministic + Playwright verification, evidence report, hints (already-existing `hints[]` field on `build_stages`) | No new gating — verification itself should **not** be paywalled, matching your research's correct instinct that this is the acquisition engine |
| Paid (existing `challenge_limit` entitlement, reused) | More concurrent/monthly challenge starts across both modes | Zero new code — the existing middleware already applies to `/challenges/:slug/start` regardless of `build_mode` |
| Paid (new `ai_repair_credits` entitlement) | "Fix with AI" on failing gates, metered like `PLAN_LIMITS` already meters AI coach queries in `ai.service.ts` | Add one entitlement type + one new route guarded by `requireEntitlement('ai_repair_credits')`, following the exact pattern already in `build-haven/routes.ts` |

This directly answers your brief — "if someone pays they feel it was worth it" — because the thing being sold is **autonomy** (an agent closing the loop on a failure it can see the exact evidence for), not verification access, matching the strongest monetization insight in your own pasted research.

---

## 8. Phased build plan (grounded in your actual codebase, not a generic roadmap)

**Phase 0 — Data model + mode picker (small, low-risk)**
- Migration in §2.1.
- `BuildModePicker.tsx` on `BuildChallengePage.tsx`.
- `startChallenge()` branch: vibe path creates an enrollment without requiring GitHub.
- No changes to the existing traditional pipeline.

**Phase 1 — Deterministic vibe verification (the core new build)**
- `sandbox.service.ts` (build+serve two-container pattern, §4.2).
- Journey JSON schema + a minimal Playwright runner script.
- Extend admin `stages` tab with the Journey Builder for `contract`-type stages.
- Extend `BuildStageSidebar` / `StagePassModal` to render gate checklists (data-driven from the same `structured_feedback` shape traditional mode already writes).
- Ship with **one submission path only**: "paste your GitHub repo" (still reuses `GitHubService`, but without requiring a template-repo fork — just clone-and-build). This gets you to a working vibe track fastest.

**Phase 2 — Evidence UX + AI Judge escalation**
- Failing-gate detail view (expected/observed/evidence — the "why did I get 93" pattern).
- Route ambiguous `visual_checks` through `AIProviderService` to a cheap vision-capable model.
- Golden Build / reference-demo admin tab.

**Phase 3 — Monetized AI Repair loop**
- `ai_repair_credits` entitlement.
- "Fix with AI" button → narrow-scoped agent call with just the failing evidence → re-run the specific gate → update score.
- Analytics: extend the existing `getAnalytics()` to break down by `build_mode` (trivial `group by` addition).

**Phase 4 — Broaden submission paths and stacks**
- Live-URL and zip-upload submission types.
- Second language/framework base image (Python/FastAPI, etc.), following the existing per-language config pattern in `build_challenge_languages`.

---

## 9. What NOT to do

- **Don't rebuild the traditional pipeline.** It works, it's isolated, it's queued, it's monitored. Any redesign urge should be redirected at the *new* vibe-mode gap, not at code that already runs in production shape.
- **Don't build a separate "Vibe Haven" product/table/admin section.** You'd duplicate the catalog, entitlements wiring, and analytics you already have, and you'd have to keep two admin UIs in sync forever. The `program_type`/`available_modes` discriminator pattern is *already your own architecture decision* from months ago (`comment on column ... program_type is 'Discriminator'`) — extend it, don't fork it.
- **Don't reach for an AI judge as the default verifier.** Your own research is right about this, and your infra (self-hosted Docker, not free client-side WebContainers) makes it *more* important than the research assumed: every AI call here is a real marginal cost on your box, not a near-zero browser-side operation. Deterministic Playwright checks first, always.
- **Don't gate verification itself behind payment.** Gate the *autonomous repair* behind payment. This is the single highest-leverage decision in the whole plan for "does the payer feel it was worth it," and it's cheap to build because your entitlements middleware already exists for exactly this shape of gating.I’ve got the uploaded audit. The important correction is that your existing Build Haven already has the **traditional CodeCrafters machinery**, so we should design the new model around that rather than inventing a second platform. 

Your actual gap is very focused: today a stage means **“run a test command against a Git commit”**; vibe mode needs **“take a finished application and prove a sequence of product behaviors.”** Your audit also confirms the missing pieces: no serve-and-test runtime, browser automation, acceptance-contract schema, visual verification, or non-GitHub submission path. 

So I would now refine the concept like this:

## Don't replace CodeCrafters stages with "AI stages"

Replace them with **Product Milestones + Proof Gates**.

A challenge such as:

> **Build a Task Management App**

could have this structure:

```text
PRODUCT
│
├── Milestone 1 — App Foundation
│   ├── App launches
│   ├── Main UI exists
│   └── Navigation works
│
├── Milestone 2 — Task Lifecycle
│   ├── Create
│   ├── Edit
│   ├── Complete
│   └── Delete
│
├── Milestone 3 — Data
│   ├── Persistence
│   ├── Refresh
│   └── Correct state
│
├── Milestone 4 — UX
│   ├── Search
│   ├── Filters
│   ├── Empty state
│   └── Error state
│
└── Milestone 5 — Production Polish
    ├── Responsive
    ├── Accessibility
    ├── Console errors
    └── Performance
```

The key difference is that **the learner is not required to implement Milestone 1 before asking an AI agent to implement Milestone 2**.

They can give Claude/Codex/Cursor:

> “Build the entire Task Manager.”

and submit it.

Your platform then runs:

```text
Gate 1 → PASS
Gate 2 → PASS
Gate 3 → FAIL
Gate 4 → PASS
Gate 5 → PARTIAL
```

That directly solves your concern about a single prompt.

---

# What you should actually give the learner

I would give **five things**, not a starter repository full of implementation code.

### 1. Product Brief

The exact thing they need to build.

### 2. Golden Demo

A live working version they can interact with.

This becomes your modern equivalent of CodeCrafters' demo/example.

### 3. Public Product Contract

Tell them:

```text
Your application must allow a user to:

1. Create a task
2. Edit it
3. Complete it
4. Delete it
5. Search
6. Filter
7. Persist it after reload
```

### 4. Assets / starter shell

Optional.

For example:

```text
assets/
  logo.svg
  icons/
design/
  reference.png
```

But **do not give implementation code unless the challenge specifically wants it.**

### 5. Verification checkpoints

This is the important replacement for CodeCrafters' stage progression.

---

# The hidden trick: public steps vs hidden checks

Suppose you publicly tell the learner:

> **Milestone 3: Persistence**

> Tasks must remain after page refresh.

But your hidden verifier does:

```text
1. Create task
2. Reload
3. Verify task exists
4. Create second task
5. Reload
6. Verify both
7. Delete first
8. Reload
9. Verify only second exists
```

The learner knows **what must work**.

They don't know your **exact test sequence**.

That's essentially the modern version of CodeCrafters' public instructions + hidden test suite.

Your uploaded design already points toward this with `acceptance_contract`, journeys and admin-only checks. 

---

# The biggest change I would make to the uploaded plan

There is one thing I would **not** make mandatory:

> `data-testid` everywhere.

Your audit proposes that as the pragmatic selector strategy. 

It is useful, but don't make it the foundation of the product.

Because then you are subtly telling users:

> “Build your application according to our internal test framework.”

That reduces implementation freedom.

Instead use a selector hierarchy:

```text
1. accessibility role/name
2. semantic HTML
3. stable data-testid where explicitly required
4. URL/navigation
5. DOM structure
6. visual/AI fallback
```

Example:

```javascript
page.getByRole('button', { name: 'Add task' })
```

is much more robust than assuming:

```javascript
[data-testid="add-task"]
```

And AI-generated applications from React, Vue, Svelte, plain HTML, etc. have a better chance of working.

---

# Your stages should actually be executable user journeys

This is the heart of the system.

Don't store:

```text
Stage:
"Implement CRUD"
```

Store:

```json
{
  "id": "task_creation",
  "label": "User can create a task",
  "public": true,
  "steps": [
    {"action": "goto", "path": "/"},
    {"action": "click", "target": "Add Task"},
    {"action": "fill", "target": "Task title", "value": "Learn Spring Boot"},
    {"action": "click", "target": "Save"},
    {"action": "expect", "target": "Learn Spring Boot", "state": "visible"}
  ]
}
```

Your audit's acceptance-contract direction is exactly right. 

But I'd make the schema **semantic**, rather than hardcoding selectors everywhere.

---

# And then verification becomes a replayable movie

This is something I would make central to the product.

After submission:

```text
VERIFYING BUILD

▶ Launching application
✓ Application started in 2.8s

▶ Create Task
✓ Clicked Add Task
✓ Entered "Learn Spring Boot"
✓ Created task

▶ Persistence
✓ Reloaded browser
✗ Task disappeared

▶ Search
✓ Search field found
✓ Search returned expected result
```

Then the user can click:

**View Replay**

and watch your Playwright/browser session.

That is much more compelling than a terminal log.

---

# This also answers "what replaces the solution?"

Don't show the solution immediately.

Use a **four-level help system**:

```text
Level 1
Requirement explanation

Level 2
Hint

Level 3
Failure diagnosis

Level 4
Reference implementation / AI repair
```

For example:

### Failure

> Task disappears after refresh.

### Hint

> Your task currently exists only in client-side memory.

### Deeper hint

> Think about what survives a browser reload.

### Reference approach

> localStorage / IndexedDB / backend database

### Premium

**Fix with AI**

That is much more modern than handing someone a finished GitHub repository.

---

# There is another feature I would add to your existing architecture

Your current system has `build_stage_results` with `structured_feedback`, so you don't need a radically new result model. Your audit already correctly identifies this reuse. 

But change the conceptual result from:

```text
Stage passed
```

to:

```text
Proof Gate

9/10 assertions passed
Evidence:
  screenshot
  DOM state
  network trace
  console log
  video/replay
```

So a user sees:

```text
┌───────────────────────────────┐
│ Persistence Gate              │
│                               │
│ ✓ Create task                 │
│ ✓ Save task                   │
│ ✓ Refresh                     │
│ ✕ Data survived refresh       │
│                               │
│ Score: 75%                    │
│                               │
│ [View Evidence] [Fix with AI] │
└───────────────────────────────┘
```

---

# And this is where your monetization becomes very clean

Your uploaded plan is correct that **verification itself should remain free**, while AI repair is premium. 

I would make the experience:

### Free

**Build → Submit → Proof**

```text
✓ Functional verification
✓ Browser journeys
✓ Basic visual checks
✓ Accessibility
✓ Evidence
✓ Score
✓ Hints
```

### Premium

**Build → Submit → Proof → Repair**

```text
✓ Everything in Free
✓ AI diagnosis
✓ AI code changes
✓ Re-run failed gate
✓ Regression verification
✓ More attempts
```

So you're not charging people to find out that their application is broken.

You're charging them to get an **autonomous engineer that fixes the breakage**.

---

# And I think you should keep both modes

Your uploaded audit's "one catalog, two verification strategies" is exactly the right architectural choice. 

A challenge can say:

```text
Build a URL Shortener

Modes:
○ Traditional
○ Vibe Coded
```

### Traditional

```text
starter repo
→ stage
→ commit
→ webhook
→ docker test
→ next stage
```

### Vibe

```text
product brief
→ golden demo
→ build however you want
→ submit
→ browser/runtime proof
→ next proof gate
```

Same challenge.

Same catalog.

Same leaderboard.

Same analytics.

Different verification engine.

That is a much stronger platform than splitting it into two products.

---

# One thing I would change in the roadmap

Your uploaded Phase 1 says the first vibe submission path should be:

> "paste your GitHub repo."

That's sensible technically, but I would eventually make **local ZIP upload** available very early.

Because your target user is explicitly:

> “I built this with Claude Code/Cursor/Lovable.”

They may not have GitHub configured.

A better first submission flow is:

```text
Submit Build

[ GitHub Repository ]
[ Upload ZIP ]
[ Live URL ]       ← later
[ Connect Sandbox ] ← later
```

For MVP, GitHub + ZIP is enough.

---

# The final conceptual model

I think you should now stop thinking:

> **"How do we recreate CodeCrafters' starter-code workflow for vibe coding?"**

Instead think:

> **"How do we recreate CodeCrafters' progressive verification discipline when implementation can happen in one prompt?"**

The answer is:

```text
CodeCrafters
    │
    ├── Challenge
    ├── Starter
    ├── Stage
    ├── Test
    └── Solution

Build With X
    │
    ├── Product Challenge
    ├── Golden Demo
    ├── Product Contract
    ├── Proof Gate
    ├── Evidence
    ├── Hint
    ├── AI Repair
    └── Reference Build
```

And the most important philosophical line for the product is:

> **We don't care whether you wrote the code, prompted an AI, or used an agent. We care whether the product you submitted satisfies the contract.**

Your existing codebase is unusually well positioned for this because the traditional pipeline, queues, Docker isolation, admin challenge builder, stage results, entitlements and AI provider abstraction are already implemented. 

The next step I would take is **not coding yet**. I would first design one complete challenge — say **“Build a Task Manager”** — all the way from **challenge page → public requirements → hidden tests → Playwright journeys → evidence → score → hints → AI repair → final solution**. That single challenge will expose almost every architectural decision you need for the whole platform.
