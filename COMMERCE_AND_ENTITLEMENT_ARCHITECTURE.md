# COMMERCE AND ENTITLEMENT ARCHITECTURE — Learning Haven / FORGE

---

## Overview

Learning Haven uses a **multi-layered commerce architecture** with two payment API versions (v1 legacy, v2 transactional), a database-driven entitlement system, and a referral/wallet system.

**CRITICAL ACTION REQUIRED:** Deprecate v1 and migrate all flows to v2.

---

## 1. Plans Architecture

### Plan Data Sources (Conflicting — Fix Required)

| System | Table | Used By |
|--------|-------|---------|
| Legacy | `plans_config` | `utils/plans.ts`, v1 PaymentsService |
| Current | `plans` | v2 PaymentsV2Service, EntitlementsRepository |

**Fix:** `utils/plans.ts::getPlans()` must read from `plans` table.

### Plan Schema (v2 `plans` table)
```sql
CREATE TABLE public.plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,               -- 'Basic' | 'Standard' | 'Pro' | 'Super'
  slug        TEXT UNIQUE NOT NULL,        -- 'free' | 'basic' | 'standard' | 'pro' | 'super'
  
  -- Pricing (all in Paise, inclusive of GST)
  price_monthly   INTEGER,                 -- e.g., 79900 = ₹799
  price_annual    INTEGER,                 -- e.g., 699900 = ₹6,999
  price_lifetime  INTEGER,
  price_one_time  INTEGER,
  
  features    JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN DEFAULT true,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Hardcoded Fallback Plans (utils/plans.ts)
```
basic-monthly    ₹299/mo
standard-monthly ₹499/mo  
pro-monthly      ₹799/mo
basic-yearly     ₹2,999/yr
standard-yearly  ₹4,499/yr
pro-yearly       ₹6,999/yr
```

---

## 2. Payment Flow (v2 — Authoritative)

```
User clicks "Upgrade" → POST /api/v2/payments/create-order
  ├── Validate plan from DB (plans table)
  ├── Apply coupon (validated server-side, per-user tracking)
  ├── Calculate GST (18% inclusive of price)
  ├── Create Razorpay order (or free_order_ bypass for ₹0)
  ├── Insert payment record (status: 'created')
  └── Return { razorpayOrderId, finalAmount, keyId }

User completes Razorpay checkout → POST /api/v2/payments/verify
  ├── Verify Razorpay HMAC-SHA256 signature
  ├── BEGIN TRANSACTION
  │   ├── Lock payment row (FOR UPDATE)
  │   ├── Check idempotency (already captured? Return early)
  │   ├── Update payment → status: 'captured'
  │   ├── Cancel existing active subscriptions
  │   ├── Create new subscription record
  │   ├── Update user.current_plan + user.active_subscription_id
  │   ├── Grant resource entitlements (if resource purchase)
  │   ├── Record coupon usage (coupon_usages table)
  │   └── COMMIT
  ├── Invalidate all entitlement/plan caches
  ├── Enqueue BullMQ: 'referral.check-and-activate'
  └── Enqueue BullMQ: 'payment.welcome-email'

Razorpay Webhook → POST /api/v2/payments/webhook
  ├── payment.captured → Log (frontend already handled, TODO: add fallback)
  ├── payment.failed → Mark payment failed
  └── refund.created → Cancel subscription, reset user to 'free'
```

### GST Calculation
```typescript
// Prices are MRP-inclusive (tax included in displayed price)
// GST Rate: 18%
const baseAmount = Math.round(mrp / 1.18);
const gstAmount = mrp - baseAmount;
const cgst = Math.round(gstAmount / 2);
const sgst = gstAmount - cgst;
```

---

## 3. Entitlement Architecture

### Data Model

```
plans → plan_entitlements → user_entitlements
                                    ↑
                           source: subscription | payment
```

### Entitlement Types

| Type | Description | Example |
|------|-------------|---------|
| `boolean` | Feature on/off | `resume_builder: true` |
| `numeric_limit` | Capped usage | `ai_queries_per_day: 10` |
| `resource_access` | Access to specific item | `course_access` for course_id: xyz |

### Feature Keys (Complete List)
```
chapters_access           boolean   Access to chapter learning
problem_access            boolean   Access to practice problems  
ai_queries_per_day        numeric   Daily AI coach queries
resume_builder            boolean   Resume builder access
certificates_access       boolean   Certificate generation
job_alerts                boolean   Daily job alerts
whatsapp_tasks            boolean   WhatsApp daily tasks
challenge_limit           numeric   Max active build challenges
skip_tokens               numeric   Monthly chapter skip tokens
course_access             resource  Specific course access
career_path_access        resource  Specific career path
project_access            resource  Specific project
apprenticeship_access     resource  Specific apprenticeship program
```

### Entitlement Check Flow
```typescript
// In middleware (entitlements.middleware.ts)
requireEntitlement('certificates_access')
  → EntitlementsService.checkEntitlement(userId, 'certificates_access')
    → EntitlementsRepository.getUserPlanAndEntitlements(userId)
      → Redis cache (15 min TTL) OR Postgres query
        → JOIN users → subscriptions → plan_entitlements → user_entitlements
    → Evaluate based on entitlement type
    → Return { allowed: boolean, reason?, upgradeRequiredPlan? }
```

### Cache Strategy
```
Redis keys:
  entitlements:{userId}              → Full entitlement map (15 min TTL)
  content_entitlements:{userId}      → Content access map (15 min TTL)
  user_plan:{userId}                 → Plan info (15 min TTL)
  plan_entitlements:*                → Plan-level entitlement configs (60 min TTL)

Invalidation triggers:
  - Payment verified → del entitlements:{userId}, content_entitlements:{userId}, user_plan:{userId}
  - Admin updates plan → del plan_entitlements:*
```

---

## 4. Coupon System

### Coupon Schema
```sql
CREATE TABLE public.coupons (
  id                  UUID PRIMARY KEY,
  code                TEXT UNIQUE NOT NULL,          -- e.g., 'LAUNCH50'
  type                TEXT NOT NULL,                 -- 'percentage' | 'fixed_amount'
  value               INTEGER NOT NULL,              -- For percentage: 50 = 50%. Fixed: paise amount
  max_discount        INTEGER,                       -- Max discount in paise (cap for percentage)
  is_active           BOOLEAN DEFAULT true,
  valid_from          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  max_uses            INTEGER,                       -- null = unlimited
  used_count          INTEGER DEFAULT 0,
  one_use_per_user    BOOLEAN DEFAULT false,
  applicable_plan_slugs TEXT[],                      -- null = all plans
  
  -- v1 legacy fields (deprecated)
  discount_percent    INTEGER,
  discount_fixed      INTEGER,
  min_amount          INTEGER,
  applicable_plans    TEXT[],
  valid_until         TIMESTAMPTZ
);

CREATE TABLE public.coupon_usages (
  coupon_id   UUID REFERENCES public.coupons(id),
  user_id     UUID REFERENCES public.users(id),
  payment_id  UUID,
  discount_applied INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (coupon_id, user_id)       -- Enforces one_use_per_user at DB level
);
```

### Validation Logic (v2)
1. Code exists + `is_active = true`
2. Not expired (`expires_at > NOW()`)
3. Not yet valid (`valid_from <= NOW()`)
4. Usage limit not exceeded (`used_count < max_uses`)
5. Applicable to this plan slug
6. Per-user limit check via `coupon_usages` table

---

## 5. Subscription Lifecycle

```
created → active → (cancel_at_period_end = true) → cancelled
                                                → (refund) → refunded
       → active → (admin/webhook refund) → cancelled + user.current_plan = 'free'
```

### Subscription Schema Key Fields
```sql
subscriptions:
  status              'active' | 'cancelled' | 'expired'
  billing_cycle       'monthly' | 'annual' | 'lifetime' | 'one_time'  
  current_period_start  TIMESTAMPTZ
  current_period_end    TIMESTAMPTZ
  cancel_at_period_end  BOOLEAN DEFAULT false   -- Soft cancel
  cancel_reason         TEXT
  cancelled_at          TIMESTAMPTZ
  amount_paid           INTEGER                 -- Paise
```

---

## 6. Referral & Wallet System

### Flow
```
New user signs up with referral code
  → POST /api/v2/referrals/apply (at signup)
    → Validate code + referrer age (>7 days)
    → Calculate fraud score (IP: +40, device: +30, velocity: +30)
    → Insert referral with status 'pending' (or 'suspicious' if score >= 70)

Referred user pays
  → BullMQ: 'referral.check-and-activate' (triggered by payment)
    → Links payment to referral
    → Sets credit_eligible_at = NOW() + 7 days
    → Schedules 'referral.credit-commission' with 7-day delay

7 days later (BullMQ delayed job)
  → ReferralsV2Service.creditReferralCommission(referralId)
    → Verify payment not refunded
    → Calculate commission (tier-based %)
    → BEGIN TRANSACTION
      → Update user.wallet_balance + total_referral_earnings
      → Update referral status → 'active'
      → Update referral_codes totals
    → COMMIT
```

### Commission Tiers (from referral_commission_tiers table)
```
0-2 active referrals     → 10% commission
3-9 active referrals     → 15% commission  
10+ active referrals     → 20% commission
```

### Wallet Withdrawal
- Minimum: ₹100 (10000 paise) — **frontend incorrectly shows ₹1**
- Method: UPI
- Processing: 24-48 hours (manual admin review via admin panel)
- Status: `pending` → `processed` | `rejected`

---

## 7. V1 → V2 Migration Plan

### Step 1: Redirect Frontend (Immediate)
Update all frontend payment calls to use v2 endpoints:
```typescript
// BEFORE
api.post('/payments/create-order', { planId })
api.post('/payments/verify', { razorpayOrderId, ... })

// AFTER
api.post('/v2/payments/create-order', { planId, billingCycle: 'monthly' })
api.post('/v2/payments/verify', { razorpayOrderId, ... })
```

### Step 2: Fix v1 Coupon Bug (Immediate — BUG-006)
### Step 3: Add 301 Redirects on v1 Routes (1 week)
### Step 4: Remove v1 Routes (30 days)
### Step 5: Remove `plans_config` Table (after v1 removed)

---

## 8. Security Considerations

| Risk | Mitigation |
|------|-----------|
| Amount tampering | Server fetches price from DB, never trusts client amount |
| Coupon double-spend (v1) | Fix BUG-024: move increment into transaction |
| Coupon double-spend (v2) | `coupon_usages` with PRIMARY KEY prevents it |
| Idempotency | `requireIdempotencyKey` middleware on all write payment routes |
| Webhook replay | Razorpay signature verification on each webhook call |
| Free order bypass | `free_order_` prefix allows bypass; ensure all downstream checks validate this |
| Refund fraud | Refund via Razorpay webhook → cancels subscription atomically |
