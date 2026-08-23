# FIXES IMPLEMENTED

All fixes are source-verified and production-quality. No mock implementations.

---

## BH-001 — Admin `tsc -b` Build Failure

**Root Cause:** `deleteMut.onSuccess` callback referenced `id` which was only in scope as the `mutationFn` parameter, not in `onSuccess`. TypeScript correctly flagged this at compile time.

**Fix:** Capture mutation variables via React Query's second `onSuccess` argument: `onSuccess: (_data, id) => { ... }`.

**Files Changed:**
- `apps/admin/src/pages/Courses.tsx` — line 54: `onSuccess: () =>` → `onSuccess: (_data, id) =>`

**DB/API Changes:** None

**Verification:** `pnpm --filter @repo/admin tsc -b` now compiles without errors.

---

## BH-006 — Practice "Solve" Button Always Dead

**Root Cause:** The "Solve" button was `<a href={problem.link || "#"}>` where `problem.link` was never in the DB schema (`problems` table has no `link` column), was stripped in the service mapper, and was `undefined` for every problem unconditionally. The button also had a 4-line developer comment questioning its own existence, confirming it was never resolved.

**Fix:** Replaced the dead external link with an in-app "Practice" button that marks the problem status as `tried` (a meaningful action since problems are solved in-app). Shows "Done ✓" when already solved.

**Files Changed:**
- `apps/web/src/pages/TopicsPage.tsx` — lines 398-411: replaced dead `<a>` with working `<button>`

**DB/API Changes:** None

**Verification:** Practice page now renders functional "Practice" / "Done ✓" buttons. No dead `href="#"` links.

---

## BH-007 — Non-Atomic XP Update (Race Condition)

**Root Cause:** `chapters.service.ts:unlockChapter()` awarded XP via a Supabase read-modify-write pattern:
1. Read `userRow.xp` into app memory
2. Compute `(userRow?.xp || 0) + xpReward`
3. Write back to DB

Two concurrent requests (double-click, two browser tabs, retry-after-timeout) would both read the same starting XP, compute the same new value, and one write would clobber the other — a confirmed lost-update race condition.

**Fix:** Replaced with a call to the atomic `public.increment_xp` Postgres function (added in migration BH-008) which uses a `UPDATE users SET xp = xp + amount` — a DB-side operation that is inherently atomic and serializable.

**Files Changed:**
- `apps/api/src/modules/learning/services/chapters.service.ts` — lines 541-556: replaced read-modify-write with `pool.query('SELECT public.increment_xp(...)')`

**DB/API Changes:** Requires `20260823000001_xp_ledger.sql` migration (adds `increment_xp` function)

**Verification:** XP update is now a single atomic DB statement; no read-modify-write path exists in this code path.

---

## BH-008 — `increment_xp` RPC Undefined in Migrations

**Root Cause:** `tasks.service.ts:updateTask()` called `supabase.rpc('increment_xp', { p_user_id, p_amount })` on task completion, but this function had no corresponding definition in any migration file. Either it existed only in the live Supabase project (schema drift) or it would throw `function does not exist` at runtime.

**Fix (two parts):**
1. Added migration `20260823000001_xp_ledger.sql` which creates `public.increment_xp(p_user_id, p_amount, p_source, p_idempotency_key)` as a proper Postgres function with idempotency guarantees.
2. Updated `tasks.service.ts` to call the function via `pool.query('SELECT public.increment_xp($1,$2,$3,$4)', ...)` with an idempotency key of `task_completion:{taskId}` to prevent double-awards on retry.

**Files Changed:**
- `apps/api/supabase/migrations/20260823000001_xp_ledger.sql` — NEW: XP ledger table + function
- `apps/api/src/modules/apprenticeship/services/tasks.service.ts` — replaced `supabase.rpc('increment_xp')` with `pool.query`

**DB/API Changes:** New migration `20260823000001_xp_ledger.sql` creates:
- `public.xp_ledger` table with idempotency key constraint
- `public.increment_xp` function (SECURITY DEFINER, idempotent)
- Backfills existing XP balances as a synthetic baseline ledger entry

**Verification:** Function is now properly defined in migrations. Idempotency key prevents double-awards.

---

## BH-009 — Task Submission Notes: Silent Data Loss

**Root Cause (three-layer):**
1. **Route handler** (`chapters.ts`): `POST /:chapterId/progress/task` destructured only `{ chapterId }` from `req.params` — never read `req.body.notes`
2. **Service** (`chapters.service.ts`): `updateTaskProgress(userId, chapterId)` accepted no `notes` parameter
3. **Schema**: No `task_response` or `task_submitted_at` columns existed on `user_chapter_progress`

Result: The frontend sent notes correctly (`learningService.completeTask(chapterId, notes)` → `POST body: { notes }`), but the server silently discarded them. The learner's response existed only in localStorage.

**Fix (three-layer):**
1. Route handler now reads `const { notes } = req.body` and passes it to the service
2. Service method updated to `updateTaskProgress(userId, chapterId, notes?: string)` — persists `task_response`, `task_submitted_at`, clears draft on submit
3. New migration adds `task_response TEXT`, `task_submitted_at TIMESTAMPTZ`, `task_draft TEXT`, `task_draft_saved_at TIMESTAMPTZ` to `user_chapter_progress`
4. New `saveTaskDraft()` service method + new `POST /:chapterId/progress/task/draft` endpoint for auto-save
5. Frontend `TaskSection` updated with debounced server-side draft saves (1.5s after last keystroke)
6. Frontend `learningService` extended with `saveDraft(chapterId, draft)` method

**Files Changed:**
- `apps/api/supabase/migrations/20260823000002_task_responses.sql` — NEW
- `apps/api/src/modules/learning/routes/chapters.ts` — route reads body, adds draft endpoint
- `apps/api/src/modules/learning/services/chapters.service.ts` — updated method signature + new `saveTaskDraft()`
- `apps/web/src/features/learning/api/learning.service.ts` — added `saveDraft`
- `apps/web/src/features/learning/components/TaskSection.tsx` — debounced server draft save + UX text

**DB/API Changes:** Migration `20260823000002_task_responses.sql` adds 4 columns to `user_chapter_progress`.

**Verification:** Submitting a task now writes the response to `user_chapter_progress.task_response`. AI Mentor can now access this data.

---

## BH-011 — AI Mentor Context Gap

**Root Cause:** `getMentorContext()` in `GamificationService` computed a rich learner profile (active course/chapter, streak, XP, days inactive, weak topics, contextual scenario) but was only called for dashboard nudge cards. The live chat endpoint `AIService.chatStream()` built its message array from only: static `SYSTEM_PROMPT` + optional `problemId` context + last 10 chat messages. The learner's entire learning state was invisible to the LLM unless they manually restated it.

**Fix:** At the start of `chatStream()`, `getMentorContext(userId)` is now called and the result is injected as a second system message containing:
- Active course and chapter
- Last completed chapter
- Current streak
- Days inactive
- Contextual scenario and nudge message

The context fetch is wrapped in try/catch — if it fails (DB unavailable, cold start), the chat continues with only the static system prompt. No crash.

**Files Changed:**
- `apps/api/src/modules/execution/services/ai.service.ts` — added `GamificationService` import + context injection in `chatStream()`

**DB/API Changes:** None

**Verification:** Every AI Mentor chat request now includes learner context. The LLM has automatic access to the learner's progress state without requiring the learner to explain it.

---

## BH-010 — No Course Purchase Entry Point on Catalog

**Root Cause:** `CoursesCatalogPage.tsx` used a single `goToCourse(id)` function that always navigated to `/course/:id/chapters` regardless of `is_premium` status. There was no price display, no "Buy" CTA, and no different behavior for premium vs free courses at the catalog level.

**Fix:** `goToCourse()` now checks `course.is_premium && !isEnrolled`:
- Premium course + not enrolled → navigates to `/subscription?course_id=:id&ref=catalog`
- Free course OR already enrolled → navigates to `/course/:id/chapters` (existing behavior)

**Files Changed:**
- `apps/web/src/pages/CoursesCatalogPage.tsx` — replaced single `navigate` with conditional routing

**DB/API Changes:** None

**Verification:** Clicking a premium course when not subscribed now routes to the subscription/pricing page. Enrolled and free courses retain existing behavior.

---

## BH-002 — Web Bundle: No Code-Splitting (1.64 MB Initial Load)

**Root Cause:** All route-level page components were statically imported in `App.tsx`, causing Vite to bundle them all into a single chunk. Monaco editor, Career Center pages, Apprenticeship module, and AI Coach all loaded on every first page view — even for learners who only visit the dashboard.

**Fix:** Converted all route-level component imports to `React.lazy()` dynamic imports wrapped in a top-level `Suspense` boundary with a minimal `PageLoader` fallback. `AuthProvider` (wraps all routes) remains a static import since it's needed before any route renders.

**Files Changed:**
- `apps/web/src/App.tsx` — converted ~25 static imports to `React.lazy()`; added `Suspense` with `PageLoader`; added `AuthProvider` import

**DB/API Changes:** None

**Verification:** `vite build` now produces separate `.js` chunks per route. Initial load no longer includes Monaco editor or Career Center. Total chunk count increases but individual page loads are dramatically smaller.
