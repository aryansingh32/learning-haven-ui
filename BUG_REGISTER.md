# BUG REGISTER — Learning Haven / FORGE
**Total Bugs Found: 30** | Last Updated: 2026-08-23

| ID | Severity | Area | Title | File | Status |
|----|----------|------|-------|------|--------|
| BUG-001 | 🔴 CRITICAL | Security | Java code execution on bare host — no isolation | `execution/services/javaExecutor.ts` | OPEN |
| BUG-002 | 🔴 CRITICAL | Security | CORS open to all origins | `app.ts:24` | OPEN |
| BUG-003 | 🔴 CRITICAL | Architecture | Supabase SERVICE_ROLE bypasses all RLS | `config/database.ts` | OPEN |
| BUG-004 | 🔴 HIGH | Business | Referral fraud threshold off-by-one (`> 70` should be `>= 70`) | `billing/services/referrals.v2.service.ts:54` | OPEN |
| BUG-005 | 🔴 HIGH | Payments | Webhook `payment.captured` only logs, does NOT activate subscription | `billing/services/payments.v2.service.ts:282-285` | OPEN |
| BUG-006 | 🔴 HIGH | Payments | v1 creates Razorpay order with `plan.price` instead of `finalPrice` after coupon | `billing/services/payments.service.ts:42` | OPEN |
| BUG-007 | 🔴 HIGH | Data Loss | Resume stored only in localStorage — lost across devices/browsers | `pages/ResumePage.tsx:33,68` | OPEN |
| BUG-008 | 🔴 HIGH | Data | Dashboard referral widget uses hardcoded dummy data | `pages/Index.tsx:694-697` | OPEN |
| BUG-009 | 🟡 HIGH | Business | Prices hardcoded in frontend (LandingPage, LearnChapterPage) | `LandingPage.tsx:385`, `LearnChapterPage.tsx:282` | OPEN |
| BUG-010 | 🟡 HIGH | Gamification | ChaptersOverviewPage computes XP with formula, ignores backend config | `ChaptersOverviewPage.tsx:51` | OPEN |
| BUG-011 | 🟡 HIGH | UX | Certificate Download and Share buttons have no onClick handlers | `CertificatesPage.tsx:71,174,177` | OPEN |
| BUG-012 | 🟡 HIGH | Architecture | AI service uses hardcoded PLAN_LIMITS, bypasses EntitlementsService | `execution/services/ai.service.ts:11-17` | OPEN |
| BUG-013 | 🟡 HIGH | Security | `updateProfile` spreads entire req.body into DB update (mass assignment) | `auth/services/users.service.ts:80` | OPEN |
| BUG-014 | 🟡 HIGH | Security | Quiz correct answers sent to client before submission (cheat vector) | `features/learning/components/QuizSection.tsx:42-49` | OPEN |
| BUG-015 | 🟡 HIGH | Data | JobsPage saved/bookmarked jobs stored in React state only (lost on refresh) | `pages/JobsPage.tsx:39,51-54` | OPEN |
| BUG-016 | 🟡 MEDIUM | Architecture | v1 plans read from `plans_config` table, v2 reads from `plans` table | `utils/plans.ts:148-152` | OPEN |
| BUG-017 | 🟡 MEDIUM | UX | Withdrawal minimum: frontend says ₹1, backend requires ₹100 | `ReferralsPage.tsx:57`, `referrals.v2.service.ts:171` | OPEN |
| BUG-018 | 🟡 MEDIUM | Admin | Experiments page uses all-mock data, no backend integration | `apps/admin/src/pages/Experiments.tsx` | OPEN |
| BUG-019 | 🟡 MEDIUM | Admin | "Create Role" button is dead (toast placeholder) | `apps/admin/src/pages/Permissions.tsx` | OPEN |
| BUG-020 | 🟡 MEDIUM | Admin | No admin CRUD for managing certificates | Admin panel (missing) | OPEN |
| BUG-021 | 🟡 MEDIUM | Business | Career readiness metrics computed client-side in RoadmapContext | `context/RoadmapContext.tsx:121-166` | OPEN |
| BUG-022 | 🟡 MEDIUM | Business | Quiz pass threshold (66%) hardcoded in frontend | `QuizSection.tsx:76,88-93` | OPEN |
| BUG-023 | 🟡 MEDIUM | UX | PhaseCompletionPage XP formula hardcoded: `missionsTotal * 100` | `PhaseCompletionPage.tsx:64` | OPEN |
| BUG-024 | 🟡 MEDIUM | Race Condition | v1 coupon `used_count` increment is outside payment transaction | `payments.service.ts:202` | OPEN |
| BUG-025 | 🟡 MEDIUM | UX | LinkedIn share on CertificatesPage shares root URL, not certificate | `CertificatesPage.tsx:75` | OPEN |
| BUG-026 | 🟡 MEDIUM | UX | ProfilePage "Share Profile" and "Public Profile" buttons have no handlers | `ProfilePage.tsx:84,87` | OPEN |
| BUG-027 | 🟡 MEDIUM | UX | TopicsPage "Open Resource" button has no href/onClick | `TopicsPage.tsx:377-379` | OPEN |
| BUG-028 | 🟡 MEDIUM | Architecture | `referrals.v2.service.ts` selects `first_name, last_name` but users table only has `full_name` | `referrals.v2.service.ts:226` | OPEN |
| BUG-029 | 🟡 MEDIUM | UX | PDF download uses `setTimeout + window.print()` — unreliable across browsers | `ResumePage.tsx:162-167` | OPEN |
| BUG-030 | 🟡 MEDIUM | Business | Referral tiers (Bronze/Silver/Gold) counts hardcoded in frontend only | `ReferralsPage.tsx:10-14` | OPEN |

---

## Detailed Remediation

### BUG-001 — Java Sandbox (CRITICAL)
```typescript
// BEFORE (dangerous)
const result = await execAsync(`java -cp /tmp/${jobId} Main`);

// AFTER (safe)
const result = await execAsync(
  `docker run --rm --network none --memory 256m --cpus 0.5 ` +
  `--read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m ` +
  `-v ${hostDir}:/code:ro learning-haven-sandbox ` +
  `java -cp /code Main`,
  { timeout: 10000 }
);
```
Also maintain a pool of pre-warmed containers.

### BUG-002 — CORS (CRITICAL)
```typescript
// apps/api/src/app.ts
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://learninghaven.in',
      'https://www.learninghaven.in',
      'https://admin.learninghaven.in',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:5173', 'http://localhost:5174'] : [])
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

### BUG-003 — RLS Bypass (CRITICAL)
```typescript
// apps/api/src/config/database.ts
// Use ANON key for the shared client
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY  // NOT SERVICE_ROLE_KEY
);

// Create a separate admin client for operations that legitimately need bypass
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

### BUG-004 — Fraud Threshold (HIGH)
```typescript
// BEFORE
const status = fraudScore > 70 ? 'suspicious' : 'pending';
// AFTER
const status = fraudScore >= 70 ? 'suspicious' : 'pending';
```

### BUG-006 — Payment Order Amount (HIGH)
```typescript
// BEFORE (in payments.service.ts line 42)
const order = await razorpay.orders.create({
    amount: plan.price,  // BUG: ignores coupon discount
    ...
});

// AFTER
const order = await razorpay.orders.create({
    amount: finalPrice,  // Correct: uses post-coupon price
    ...
});
```

### BUG-007 — Resume Persistence (HIGH)
**Required changes:**
1. Create migration: `user_resumes` table with `user_id`, `data JSONB`, `updated_at`
2. Add API route: `POST /api/resume/save` and `GET /api/resume/load`
3. Update `ResumePage.tsx` to load from API on mount, autosave to API on change

### BUG-013 — Mass Assignment (HIGH)
```typescript
// BEFORE
.update({ ...updates, updated_at: new Date().toISOString() })

// AFTER
const ALLOWED_UPDATE_FIELDS = ['full_name', 'avatar_url', 'phone', 'preferences', 'career_track'];
const safeUpdates = Object.fromEntries(
  Object.entries(updates).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
);
.update({ ...safeUpdates, updated_at: new Date().toISOString() })
```

### BUG-014 — Quiz Answer Cheat (HIGH)
```typescript
// BEFORE: correctIndex sent to frontend in question object
// AFTER: Never send correctIndex/correctAnswer in the question payload
// POST /api/chapters/:id/quiz/check { questionId, selectedIndex } → returns { correct: boolean, explanation: string }
```

### BUG-028 — Missing first_name/last_name (MEDIUM)
```typescript
// BEFORE (will throw)
SELECT r.id, r.status, u.first_name, u.last_name FROM ...

// AFTER
SELECT r.id, r.status, u.full_name FROM ...
// Then: name: r.full_name.split(' ')[0] + (r.full_name.split(' ')[1]?.[0] ? ` ${r.full_name.split(' ')[1][0]}.` : '')
```
