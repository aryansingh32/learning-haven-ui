# IMPLEMENTATION ROADMAP — Learning Haven / FORGE
## Prioritized Engineering Tasks to Production-Ready

**Legend:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW  
**Estimate:** S = ~1 day | M = ~3 days | L = ~1 week | XL = ~2+ weeks

---

## PHASE 0 — SECURITY HOTFIX (Ship within 48 hours)
*Do not deploy new features until these are resolved.*

| # | Task | Priority | Size | Who | Notes |
|---|------|----------|------|-----|-------|
| 0.1 | **Fix CORS** — Restrict to specific origin whitelist | 🔴 | S | Backend | `app.ts:24` |
| 0.2 | **Fix Supabase SERVICE_ROLE** — Use ANON key for shared client | 🔴 | S | Backend | `config/database.ts` |
| 0.3 | **Fix Payment v1 coupon order amount** — Use `finalPrice` not `plan.price` | 🔴 | S | Backend | `payments.service.ts:42` |
| 0.4 | **Fix `updateProfile` mass assignment** — Whitelist allowed fields | 🔴 | S | Backend | `users.service.ts:80` |
| 0.5 | **Fix referral fraud threshold** — Change `> 70` to `>= 70` | 🟠 | S | Backend | `referrals.v2.service.ts:54` |
| 0.6 | **Fix coupon race condition (v1)** — Move increment into transaction | 🟠 | S | Backend | `payments.service.ts:202` |

---

## PHASE 1 — CRITICAL DATA INTEGRITY (Sprint 1)

### 1.1 — Resume Server-Side Persistence
**Problem:** All resume data is in localStorage only. Users lose data across devices.  
**Size:** M  
**Tasks:**
- [ ] Create migration: `user_resumes` table with `user_id UUID`, `data JSONB`, `updated_at TIMESTAMPTZ`
- [ ] Add API endpoint: `GET /api/resume/load` and `POST /api/resume/save`
- [ ] Update `ResumePage.tsx`: load from API on mount, debounce-save on change (3s delay)
- [ ] Add localStorage as offline fallback only
- [ ] Migration: push existing localStorage data on first save

### 1.2 — Code Execution Sandbox
**Problem:** Java (and potentially other) code runs on the host OS without isolation.  
**Size:** L  
**Tasks:**
- [ ] Create Docker image `learning-haven-sandbox` with Java, Python, JavaScript runtimes
- [ ] Container constraints: `--network none --memory 256m --cpus 0.5 --read-only --tmpfs /tmp`
- [ ] Implement container pool (pre-warm 3 containers to avoid cold start)
- [ ] Add execution timeout (10 seconds hard kill)
- [ ] Log and alert on timeout/OOM events

### 1.3 — Fix Webhook Payment Activation
**Problem:** Webhook `payment.captured` only logs, doesn't activate subscriptions.  
**Size:** M  
**Tasks:**
- [ ] Implement fallback activation in webhook handler using order ID lookup
- [ ] Add retry logic: if payment status is still 'created' after 5 min, trigger activation
- [ ] Alert admin if webhook activation fails

### 1.4 — Dashboard Referral Widget Live Data
**Problem:** Dashboard shows hardcoded dummy referral data.  
**Size:** S  
**Tasks:**
- [ ] Remove hardcoded constants from `Index.tsx`
- [ ] Call `useApiQuery(['referral-info'], '/v2/referrals/info')` in `ReferralWidget`
- [ ] Show real referral count and tier progress

---

## PHASE 2 — FRONTEND CORRECTNESS (Sprint 2)

### 2.1 — Remove All Hardcoded Prices
**Problem:** Prices hardcoded in `LandingPage.tsx` and `LearnChapterPage.tsx`  
**Tasks:**
- [ ] Fetch pricing from `/api/v2/payments/plans` using `useApiQuery`
- [ ] Cache plan data in React Query with `staleTime: 5 * 60 * 1000`
- [ ] Update all price display strings to use fetched values
- [ ] Add loading state for price sections

### 2.2 — Fix XP Formulas in Frontend
**Problem:** XP is computed with formulas in frontend, ignoring backend config.  
**Tasks:**
- [ ] Remove `reward: { xp: 100 + ch.chapter_number * 25 }` from `ChaptersOverviewPage.tsx`
- [ ] Ensure chapters API response includes `xp_reward` field from backend
- [ ] Remove `${missionsTotal * 100}` formula from `PhaseCompletionPage.tsx`
- [ ] Read XP earned from the completion API response

### 2.3 — Certificate Page — Fix Dead Buttons
**Tasks:**
- [ ] Implement PDF generation endpoint: `GET /api/certificates/:id/pdf`
- [ ] Wire "Download PDF" button to download endpoint
- [ ] Fix "Share on LinkedIn" to include certificate-specific URL
- [ ] Wire Share buttons on certificate list items with platform-specific deep links

### 2.4 — Jobs Page — Persist Bookmarks
**Problem:** Saved jobs lost on page refresh (React state only)  
**Tasks:**
- [ ] Create `GET /api/jobs/saved` and `POST /api/jobs/save`, `DELETE /api/jobs/save/:id`
- [ ] Update `JobsPage.tsx` to use API for bookmarks
- [ ] Optimistic update with rollback on error

### 2.5 — Profile Page — Fix Dead Buttons
**Tasks:**
- [ ] Implement public profile page: `/profile/:username`
- [ ] Wire "Share Profile" button with shareable URL
- [ ] Add `username` field to users table or use ID-based public URLs

### 2.6 — Fix Withdrawal Minimum Display
**Tasks:**
- [ ] Update `ReferralsPage.tsx` line 57: change `< 1` to `< 10000` (₹100)
- [ ] Display "Minimum withdrawal: ₹100" in the UI

### 2.7 — Fix Quiz Answer Security (BUG-014)
**Problem:** Quiz correct answers are sent to client before submission — easy cheat  
**Tasks (Breaking change — requires backend + frontend):**
- [ ] Remove `correct_index`/`correct_answer` from quiz question payload
- [ ] Create endpoint: `POST /api/chapters/:id/quiz/submit { questionId, selectedIndex }` → `{ correct: boolean, explanation: string }`
- [ ] Update `QuizSection.tsx` to call this endpoint for answer checking
- [ ] Server stores quiz attempt results in `quiz_attempts` table

---

## PHASE 3 — AI & GAMIFICATION IMPROVEMENTS (Sprint 3)

### 3.1 — Unify AI Rate Limiting Through EntitlementsService
**Problem:** `ai.service.ts` has its own hardcoded limits, bypassing admin control  
**Tasks:**
- [ ] Remove `PLAN_LIMITS` constant from `ai.service.ts`
- [ ] Replace `this.checkRateLimit(userId)` with `EntitlementsService.checkAndConsumeUsage(userId, 'ai_queries_per_day')`
- [ ] Return remaining quota in AI response headers for frontend display

### 3.2 — Enrich AI Mentor Context
**Problem:** Context lacks weak topics, level, recent failures  
**Tasks:**
- [ ] Extend `GamificationService.getMentorContext()` with knowledge map data
- [ ] Add: `weakTopics`, `strongTopics`, `recentlyFailed`, `problemsSolvedThisWeek`, `target_role`
- [ ] Update system prompt builder to use new context fields
- [ ] Add per-session chat history (add `session_id` to `ai_chats` table)

### 3.3 — XP Ledger Integration
**Problem:** `xp_ledger` table migrated but not used for reads  
**Tasks:**
- [ ] All XP grants should write to BOTH `users.xp` (for fast reads) and `xp_ledger` (for audit)
- [ ] Add `GET /api/users/me/xp-history` endpoint reading from ledger
- [ ] Add XP history view to ProfilePage

### 3.4 — Career Readiness Server-Side Computation
**Problem:** Career readiness computed in `RoadmapContext.tsx` — unreliable  
**Tasks:**
- [ ] Create `GET /api/users/me/career-readiness` endpoint
- [ ] Compute: DSA score (from problem_progress), project score (from build_enrollments), consistency score
- [ ] Cache result for 1 hour per user
- [ ] Update `RoadmapContext.tsx` to just fetch from endpoint

### 3.5 — Prompt Injection Mitigation
**Tasks:**
- [ ] Add `[USER_MESSAGE_STARTS]` / `[USER_MESSAGE_ENDS]` delimiters around user input
- [ ] Add anti-jailbreak instructions to system prompt
- [ ] Max user message length: 2000 chars (validate server-side)

---

## PHASE 4 — ADMIN PANEL COMPLETENESS (Sprint 4)

### 4.1 — Certificates Admin CRUD
**Tasks:**
- [ ] Create admin route: `GET /api/admin/certificates` with pagination + search
- [ ] Create admin route: `DELETE /api/admin/certificates/:id` (revoke)
- [ ] Build `Certificates.tsx` admin page with table view
- [ ] Show: user, certificate type, issued_at, verification URL, revoke action

### 4.2 — Experiments A/B Testing Backend
**Tasks:**
- [ ] Create `experiments` and `experiment_variants` tables in DB
- [ ] Create admin API: `CRUD /api/admin/experiments`
- [ ] Implement experiment assignment: `GET /api/experiments/assignments` (for user)
- [ ] Update `Experiments.tsx` to use real backend data
- [ ] Implement "New Experiment" creation flow

### 4.3 — Role Management
**Tasks:**
- [ ] Create `roles` and `permissions` tables or use JSONB in `system_settings`
- [ ] Implement `POST /api/admin/roles` endpoint
- [ ] Wire "Create Role" button in `Permissions.tsx`
- [ ] Add granular frontend route guards based on permissions

### 4.4 — Granular Frontend Route Guards
**Tasks:**
- [ ] Expand `AuthContext.tsx` to load admin permissions
- [ ] Create `<RequirePermission permission="finance" />` wrapper component
- [ ] Apply to all admin routes: Finance, User Management, Content, etc.

---

## PHASE 5 — V1 DEPRECATION (Sprint 5)

### 5.1 — Migrate Frontend to v2 Payment APIs
- [ ] Update `commerce.service.ts` and `ApprenticeshipProgramPage.tsx` to use `/v2/payments/*`
- [ ] Update all billing cycle parameters from legacy plan IDs to `billingCycle` enum

### 5.2 — Consolidate Plan Source of Truth
- [ ] Update `utils/plans.ts::getPlans()` to read from `plans` table (not `plans_config`)
- [ ] Add migration to deprecate `plans_config` table
- [ ] Verify admin plan management writes to `plans` table

### 5.3 — Remove v1 Routes
- [ ] Add 301 redirects on v1 billing routes
- [ ] Remove v1 controllers/services after 30-day monitoring period

---

## PHASE 6 — POLISH & SCALE (Sprint 6+)

### 6.1 — PDF Certificate Generation
- [ ] Implement server-side PDF generation using Puppeteer or pdf-lib
- [ ] Generate certificate with name, topic, date, verification QR code
- [ ] Store PDF in Supabase Storage, return signed URL

### 6.2 — Real-time Progress Updates
- [ ] Audit Supabase Realtime subscriptions in `useLearnCourse.ts`
- [ ] Verify RLS policies on `user_chapter_progress` table allow only own data

### 6.3 — Analytics Instrumentation
- [ ] Implement analytics SDK in `tracker.ts` following `ANALYTICS_EVENT_SCHEMA.md`
- [ ] Add server-side event firing for all commerce events

### 6.4 — Performance
- [ ] Add `content-visibility: auto` to heavy list pages
- [ ] Implement virtual scrolling for TopicsPage problem list
- [ ] Add `staleTime` to all `useApiQuery` calls to reduce re-fetches

---

## Dependency Map

```
Phase 0 (Security) → Must complete BEFORE any deployment
Phase 1 (Data Integrity) → Can run parallel with Phase 2
Phase 2 (Frontend) → Depends on Phase 1.1 (resume persistence)
Phase 3 (AI) → Can start any time
Phase 4 (Admin) → Can start any time
Phase 5 (v1 Deprecation) → Depends on Phase 2 completion
Phase 6 (Polish) → After Phases 3-4
```

---

## Sprint Planning Summary

| Sprint | Duration | Focus | Est. Engineering Days |
|--------|----------|-------|----------------------|
| Phase 0 | Week 1 | Security hotfixes | 3 days |
| Phase 1 | Week 1-2 | Critical data integrity | 8 days |
| Phase 2 | Week 2-3 | Frontend correctness | 10 days |
| Phase 3 | Week 3-4 | AI & gamification | 8 days |
| Phase 4 | Week 4-5 | Admin completeness | 7 days |
| Phase 5 | Week 5 | v1 deprecation | 4 days |
| Phase 6 | Ongoing | Polish & scale | Continuous |

**Total to production-ready: ~6 weeks (1-2 engineers)**

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Security vulnerabilities | 3 critical | 0 critical |
| Dead buttons | 8+ | 0 |
| Hardcoded prices | 3 places | 0 |
| Resume data loss rate | 100% (on device clear) | 0% |
| Payment webhook reliability | ~99% (frontend fallback) | 99.9% (webhook + frontend) |
| Coupon fraud (self-referral) | Possible (score=70 bypass) | Blocked |
| AI quota admin control | None (hardcoded) | Full admin control |
