# REMAINING ISSUES

Issues from the deep audit that are NOT yet fixed, with reasoning for deferral.

---

## BH-003 — Payment Verify Tests Hanging

**Status:** Deferred — Requires live Razorpay test credentials and a running DB.

**Root Cause (suspected):** Jest timeout because the `payments.test.ts` suite awaits HTTP responses from services that need a real Razorpay order ID to verify against. The mock setup may not fully stub the Razorpay SDK or the pool connection.

**Work Required:**
1. Audit `apps/api/src/modules/payments/__tests__/payments.test.ts`
2. Ensure Razorpay SDK is fully mocked in `jest.setup.ts` (no real HTTPS calls)
3. Ensure `pool` mock returns expected rows for `razorpay_order_id` lookup
4. Add jest timeout override or move to integration test suite

**Risks:** None to production — tests only.

---

## BH-004 — Duplicate Payment/Billing Controllers (v1 vs v2)

**Status:** Partially identified — requires runtime analysis to confirm which is live.

**Root Cause:** The API router mounts both `v1/billing` and `v2/billing` (or equivalent). It is unclear which one processes actual Razorpay webhooks in production. The duplicate code means bugs fixed in one path may not be fixed in the other.

**Work Required:**
1. Audit `apps/api/src/routes/index.ts` to confirm which version is mounted at `/api/billing` vs `/api/v1/billing`
2. Identify which version the frontend's `BillingService` calls
3. Remove or clearly deprecate the dead version
4. Ensure webhook handler idempotency (Razorpay re-sends events)

**Risks:** Live payments — requires extreme care and staging deployment.

---

## BH-005 — Version Fork: web (React 18.3 + Vite 5.4) vs admin (React 19.2 + Vite 7.3)

**Status:** Will not fix short-term — requires careful dependency upgrade.

**Root Cause:** `apps/web` was initialized earlier and not upgraded. `apps/admin` was initialized with newer versions. The fork creates a risk of diverging behavior for shared hooks or context patterns.

**Work Required:**
1. Upgrade `apps/web` to React 19 (check for breaking changes: `ReactDOM.createRoot`, `useFormStatus`, etc.)
2. Upgrade Vite from 5.4 to 7.3 in web (test build output carefully)
3. Run full E2E test suite after upgrade

**Risks:** Major version upgrade — could break UI components. Requires staging verification.

---

## BH-012 — XP Level-Up Logic is Not Recalculated After XP Award

**Status:** Not implemented — discovered during XP system audit.

**Root Cause:** `users.level` is a stored integer, not derived. When XP is awarded, the level is never recalculated. A learner's level badge stays at level 1 indefinitely even as XP accumulates.

**Work Required:**
1. Define XP thresholds for each level (currently in `gamification_config` JSONB system setting)
2. Add level recalculation logic to `increment_xp` Postgres function OR as a trigger on `users.xp` update
3. Optionally: add `level_up_events` table to track when level-ups happened (for celebration UI)

---

## BH-013 — Streak Calculation Not Atomic

**Status:** Not implemented — separate from the XP race condition but same pattern.

**Root Cause:** Streak calculation in `gamification.service.ts` reads `last_active_date`, computes whether to increment or reset streak in JS, then writes back. Multiple concurrent requests on the same date (e.g., rapid-fire chapter completions) could each increment the streak.

**Work Required:**
1. Move streak recalculation to a `update_streak(p_user_id UUID)` Postgres function
2. Make it idempotent per day (upsert on `last_active_date` = today)

---

## BH-014 — `user_chapter_progress` Has No Populated `task_response` for Existing Users

**Status:** By design — no historical data to backfill.

**Note:** The `20260823000002_task_responses.sql` migration adds the columns with `IF NOT EXISTS`, so existing rows remain with `task_response = NULL`. This is acceptable — there's no historical response data to backfill. Going forward, all submissions will be persisted.

---

## BH-015 — Course Enrollment Table May Conflict with Subscription-Based Access

**Status:** Architectural concern — requires product decision.

**Root Cause:** `fetch​MyCourseEnrollments()` returns enrollments, but it's unclear if this is:
- A separate enrollment record (created at checkout)
- A derived value from the subscription state

If it's a separate record that's created at checkout and the subscription expires, the enrollment record may still grant access. The correct model needs to be defined.

**Work Required:**
1. Audit `apps/api/src/modules/courses/services/enrollment.service.ts`
2. Define canonical access rule: enrollment record OR active subscription?
3. Ensure `ChaptersOverviewPage` gate and `LearnChapterPage` gate agree
