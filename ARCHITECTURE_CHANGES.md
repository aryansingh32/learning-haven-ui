# ARCHITECTURE CHANGES

Documents architectural changes introduced by the audit fixes. These are design decisions that affect how the system operates going forward.

---

## 1. XP System: Ledger-Based Atomic Architecture

**Previous Architecture:**
- Every XP award path was a bespoke, non-atomic operation
- `chapters.service.ts`: read `users.xp`, add in JS, write back (non-atomic)
- `tasks.service.ts`: called `supabase.rpc('increment_xp')` with a function that didn't exist in migrations
- `gamification.service.ts`: direct `UPDATE users SET xp = xp + N` (atomic but no audit trail)

**New Architecture:**
All XP awards go through a single Postgres function: `public.increment_xp(user_id, amount, source, idempotency_key)`.

```
Frontend → API route → Service → pool.query('SELECT public.increment_xp(...)') → DB atomic UPDATE
                                                   ↓
                                          INSERT INTO xp_ledger (idempotency_key) ON CONFLICT DO NOTHING
```

**Properties:**
- **Atomic:** DB-side `UPDATE users SET xp = xp + N` is serializable
- **Idempotent:** `xp_ledger.idempotency_key` UNIQUE constraint prevents double-awards on retry
- **Auditable:** Every XP award is recorded in `xp_ledger` with source and metadata
- **Backfill:** Existing `users.xp` balances are preserved via a synthetic baseline ledger entry

**Idempotency Keys Used:**
| Source | Key Pattern |
|--------|-------------|
| Chapter unlock | `chapter_unlock:{userId}:{chapterId}` |
| Task completion | `task_completion:{taskId}` |
| Daily quest bonus | `daily_quest_bonus:{userId}:{YYYY-MM-DD}` |

**New Table:** `public.xp_ledger`
**New Function:** `public.increment_xp` (SECURITY DEFINER)

---

## 2. Task Submission: Full-Stack Persistence

**Previous Architecture:**
Notes typed by the learner were stored only in `localStorage`:
```
UI (textarea) → localStorage → [data lost on browser clear / device switch]
                          → API: POST /task (notes ignored)
```

**New Architecture:**
Notes are persisted server-side on both draft-save and submit:
```
UI (textarea) → localStorage (immediate, for fast restore)
            → debounce 1.5s → POST /task/draft → user_chapter_progress.task_draft
            
UI (Submit button) → POST /task { notes } → user_chapter_progress.task_response
                                           → task_submitted_at
                                           → task_draft = NULL (cleared on submit)
```

**New Endpoints:**
- `POST /api/chapters/:chapterId/progress/task/draft` — auto-save draft without submitting
- `POST /api/chapters/:chapterId/progress/task` — submit final answer (existing, now fixed to accept `notes`)

**New Columns on `user_chapter_progress`:**
- `task_response TEXT` — final submitted answer
- `task_submitted_at TIMESTAMPTZ` — timestamp of last submission
- `task_draft TEXT` — auto-saved draft (cleared on submit)
- `task_draft_saved_at TIMESTAMPTZ` — timestamp of last draft save

---

## 3. AI Mentor: Dynamic Learner Context

**Previous Architecture:**
Every AI Mentor chat request built messages from only:
1. Static `SYSTEM_PROMPT` string
2. Optional problem details (if `problemId` was passed)
3. Last 10 messages from `ai_chats` table

The LLM had zero automatic knowledge of who the learner was.

**New Architecture:**
```
chatStream(userId, messages, ...) {
  context = await GamificationService.getMentorContext(userId)
  
  systemMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: buildContextMessage(context) }, // ← NEW
  ]
  
  // ... then chat history + user message
}
```

**Context Injected:**
- Current enrolled course
- Active chapter (in-progress)
- Last completed chapter
- Streak count
- Days since last active
- Contextual scenario and nudge message from gamification engine

**Fault Tolerance:** Context fetch is wrapped in try/catch. If `getMentorContext` fails, the chat continues with only the static system prompt — no crash, no 500 error.

---

## 4. Web Bundle: Route-Level Code Splitting

**Previous Architecture:**
Single Vite chunk containing all route components, loaded on every first visit regardless of the route.

**New Architecture:**
Each route component is a separate Vite chunk loaded on demand:
```jsx
// Before: everything loaded together
import LearnChapterPage from "./pages/LearnChapterPage"; // Monaco editor: ~400KB

// After: loaded only when learner navigates to /chapter/:id
const LearnChapterPage = lazy(() => import("./pages/LearnChapterPage"));
```

A `Suspense` boundary at the router level shows a `PageLoader` spinner during chunk download. This is a standard, well-supported React pattern and does not require any additional library.

**Impact:**
- Initial load now downloads only: Auth wrapper + LandingPage (or DashboardPage for logged-in learners)
- Monaco editor, Career Center, Apprenticeship module, AI Coach — only downloaded when visited

---

## 5. Admin Bulk Delete: Correct Mutation Variable Capture

**Previous Architecture:**
`onSuccess: () => {...}` referenced `id` from outer scope of `mutationFn`, which TypeScript correctly flagged as an error since `id` is not in scope in `onSuccess`.

**New Architecture:**
`onSuccess: (_data, id) => {...}` captures `id` as React Query's mutation variables parameter (the same value passed to `mutationFn`). This is the idiomatic React Query pattern for accessing mutation variables in callbacks.

---

## 6. Course Catalog: Premium Routing Gate

**Previous Architecture:**
Single `goToCourse(id)` → `navigate('/course/:id/chapters')` for all courses.

**New Architecture:**
```
goToCourse(id) {
  if (course.is_premium && !isEnrolled) → navigate('/subscription?course_id=:id&ref=catalog')
  else → navigate('/course/:id/chapters')
}
```

This creates a coherent purchase funnel: catalog → subscription/pricing page → payment → enrollment → course access.
