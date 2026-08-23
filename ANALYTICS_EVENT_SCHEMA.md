# ANALYTICS EVENT SCHEMA — Learning Haven / FORGE
## Complete Event Taxonomy for Product Analytics, Growth, and AI

This document defines every analytics event that should be tracked, their properties, and the instrumentation layer.

---

## Architecture

```
Frontend Events → /api/analytics/track (POST, batched)
                     ↓
              analytics_events table (Postgres)
                     ↓
       ┌─────────────┴─────────────┐
  Prometheus Metrics          Data Warehouse
  (real-time dashboards)    (Metabase / BigQuery)
```

**Existing infrastructure:** `/api/analytics.routes.ts` exists. Verify it handles both server-side and client-side event intake.

---

## Event Base Schema

```typescript
interface AnalyticsEvent {
  // Required on all events
  event_name: string;             // snake_case, namespaced
  user_id?: string;               // null for anonymous
  session_id: string;             // Browser session UUID
  timestamp: Date;                // Client timestamp (server also records received_at)
  
  // Standard context (auto-collected by SDK)
  context: {
    page_url: string;
    page_title: string;
    referrer?: string;
    user_agent: string;
    device_type: 'mobile' | 'desktop' | 'tablet';
    plan: string;                 // Current user plan at time of event
    level: number;                // Current user level
    streak: number;               // Current streak
  };
  
  // Event-specific properties
  properties: Record<string, any>;
}
```

---

## Event Catalog

### 🔐 Authentication Events

```typescript
// user.signed_up
{
  event_name: 'user.signed_up',
  properties: {
    method: 'email' | 'google' | 'github',
    referral_code?: string,
    has_referral: boolean,
    onboarding_started: boolean,
  }
}

// user.signed_in
{
  event_name: 'user.signed_in',
  properties: {
    method: 'email' | 'google' | 'github',
    days_since_last_login: number,
  }
}

// user.onboarding_completed
{
  event_name: 'user.onboarding_completed',
  properties: {
    learning_path: string,          // from onboarding answers
    goal: string,
    experience_level: string,
    time_commitment: string,
    steps_skipped: number,
  }
}
```

### 📚 Learning Events

```typescript
// chapter.started
{
  event_name: 'chapter.started',
  properties: {
    chapter_id: string,
    chapter_number: number,
    chapter_title: string,
    topic_tag: string,
    course_id: string,
    is_first_chapter: boolean,
    days_since_enrollment: number,
  }
}

// chapter.step_completed
{
  event_name: 'chapter.step_completed',
  properties: {
    chapter_id: string,
    chapter_number: number,
    step_index: number,
    step_type: 'story' | 'video' | 'quiz' | 'task' | 'micro_revision' | 'code',
    time_spent_seconds: number,
    attempts?: number,             // For quiz steps
    score_percent?: number,        // For quiz steps
  }
}

// chapter.completed
{
  event_name: 'chapter.completed',
  properties: {
    chapter_id: string,
    chapter_number: number,
    chapter_title: string,
    topic_tag: string,
    total_time_minutes: number,
    xp_earned: number,
    completion_rank?: number,      // Position among all learners to complete this chapter
  }
}

// chapter.paywall_hit
{
  event_name: 'chapter.paywall_hit',
  properties: {
    chapter_id: string,
    chapter_number: number,
    current_plan: string,
    required_plan: string,
    upgrade_price_shown: number,
    dismissed: boolean,
  }
}
```

### 💡 Problem Solving Events

```typescript
// problem.attempted
{
  event_name: 'problem.attempted',
  properties: {
    problem_id: string,
    problem_title: string,
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard',
    language: string,
    is_first_attempt: boolean,
  }
}

// problem.solved
{
  event_name: 'problem.solved',
  properties: {
    problem_id: string,
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard',
    language: string,
    time_to_solve_seconds: number,
    attempts_count: number,
    hint_used: boolean,
    ai_help_used: boolean,
    xp_earned: number,
  }
}

// problem.hint_requested
{
  event_name: 'problem.hint_requested',
  properties: {
    problem_id: string,
    topic: string,
    difficulty: string,
    hint_type: 'approach' | 'code' | 'explanation',
    time_on_problem_seconds: number,
  }
}
```

### 🤖 AI Coach Events

```typescript
// ai_coach.message_sent
{
  event_name: 'ai_coach.message_sent',
  properties: {
    message_length: number,
    has_problem_context: boolean,
    problem_id?: string,
    session_message_count: number,  // Messages in this AI session
    daily_usage_before: number,
    daily_limit: number,
  }
}

// ai_coach.limit_reached
{
  event_name: 'ai_coach.limit_reached',
  properties: {
    current_plan: string,
    daily_limit: number,
    upgrade_shown: boolean,
    upgrade_price: number,
  }
}

// ai_coach.resume_improvement_used
{
  event_name: 'ai_coach.resume_improvement_used',
  properties: {
    section: 'experience' | 'project' | 'summary',
    text_length_before: number,
    text_length_after: number,
    accepted: boolean,
  }
}
```

### 🏗️ Build Haven Events

```typescript
// build.enrolled
{
  event_name: 'build.enrolled',
  properties: {
    program_id: string,
    program_title: string,
    language: string,
    mode: 'traditional' | 'vibe',
    is_paid: boolean,
  }
}

// build.stage_submitted
{
  event_name: 'build.stage_submitted',
  properties: {
    program_id: string,
    stage_number: number,
    total_stages: number,
    mode: 'traditional' | 'vibe',
    tests_passed: number,
    tests_total: number,
    attempt_number: number,
    time_spent_minutes: number,
    xp_earned: number,
  }
}

// build.stage_failed
{
  event_name: 'build.stage_failed',
  properties: {
    program_id: string,
    stage_number: number,
    tests_passed: number,
    tests_total: number,
    error_type: string,
    attempt_number: number,
  }
}

// build.github_connected
{
  event_name: 'build.github_connected',
  properties: {
    program_id: string,
    repo_created: boolean,
  }
}
```

### 💰 Commerce Events

```typescript
// commerce.plan_viewed
{
  event_name: 'commerce.plan_viewed',
  properties: {
    current_plan: string,
    source: 'paywall' | 'pricing_page' | 'sidebar' | 'direct',
    plans_shown: string[],
  }
}

// commerce.order_created
{
  event_name: 'commerce.order_created',
  properties: {
    plan_id: string,
    plan_name: string,
    billing_cycle: 'monthly' | 'annual' | 'lifetime',
    amount_paise: number,
    discount_amount: number,
    coupon_used: boolean,
    coupon_code?: string,
    gst_amount: number,
    api_version: 'v1' | 'v2',
  }
}

// commerce.payment_success
{
  event_name: 'commerce.payment_success',
  properties: {
    plan_id: string,
    plan_name: string,
    billing_cycle: string,
    final_amount_paise: number,
    is_upgrade: boolean,
    previous_plan: string,
    days_since_signup: number,
  }
}

// commerce.payment_failed
{
  event_name: 'commerce.payment_failed',
  properties: {
    plan_id: string,
    amount_paise: number,
    error_reason?: string,
  }
}

// commerce.subscription_cancelled
{
  event_name: 'commerce.subscription_cancelled',
  properties: {
    plan_id: string,
    days_remaining: number,
    reason?: string,
    cancel_at_period_end: boolean,
  }
}

// commerce.coupon_applied
{
  event_name: 'commerce.coupon_applied',
  properties: {
    coupon_code: string,
    discount_type: 'percentage' | 'fixed_amount',
    discount_amount: number,
    original_amount: number,
    final_amount: number,
  }
}
```

### 🎁 Referral Events

```typescript
// referral.link_copied
{
  event_name: 'referral.link_copied',
  properties: {
    referral_code: string,
    copy_method: 'button' | 'manual',
    current_tier: string,
  }
}

// referral.signup_via_referral
{
  event_name: 'referral.signup_via_referral',
  properties: {
    referral_code: string,
    fraud_score: number,
    fraud_status: 'pending' | 'suspicious',
  }
}

// referral.commission_credited
{
  event_name: 'referral.commission_credited',
  properties: {
    referral_id: string,
    commission_amount: number,   // Paise
    commission_pct: number,
    referrer_tier: string,
  }
}

// referral.withdrawal_requested
{
  event_name: 'referral.withdrawal_requested',
  properties: {
    amount: number,              // Paise
    upi_id_domain: string,       // Only domain (e.g., 'okaxis'), not full UPI ID
    wallet_balance_before: number,
  }
}
```

### 🏆 Gamification Events

```typescript
// gamification.xp_earned
{
  event_name: 'gamification.xp_earned',
  properties: {
    amount: number,
    reason: XPReason,
    source_id?: string,
    new_total_xp: number,
    level_before: number,
    level_after: number,
    level_up: boolean,
  }
}

// gamification.level_up
{
  event_name: 'gamification.level_up',
  properties: {
    new_level: number,
    old_level: number,
    new_identity?: string,
    total_xp: number,
  }
}

// gamification.streak_extended
{
  event_name: 'gamification.streak_extended',
  properties: {
    new_streak: number,
    is_milestone: boolean,        // 7, 30, 100 days
    milestone_type?: '7day' | '30day' | '100day',
    xp_bonus: number,
  }
}

// gamification.streak_broken
{
  event_name: 'gamification.streak_broken',
  properties: {
    lost_streak: number,
    freeze_used: boolean,
    freeze_count_remaining: number,
  }
}

// gamification.daily_quest_completed
{
  event_name: 'gamification.daily_quest_completed',
  properties: {
    quest_id: string,
    quest_type: string,
    xp_earned: number,
    all_quests_done: boolean,
  }
}

// gamification.badge_earned
{
  event_name: 'gamification.badge_earned',
  properties: {
    badge_id: string,
    badge_name: string,
    trigger: string,
  }
}
```

### 📄 Resume Events

```typescript
// resume.section_completed
{
  event_name: 'resume.section_completed',
  properties: {
    section: 'personal' | 'experience' | 'projects' | 'education' | 'extras',
    items_count: number,
    ats_score_after: number,
  }
}

// resume.pdf_downloaded
{
  event_name: 'resume.pdf_downloaded',
  properties: {
    template: 'standard' | 'modern' | 'classic',
    ats_score: number,
    sections_filled: number,
    has_ai_improved_content: boolean,
  }
}

// resume.autofill_used
{
  event_name: 'resume.autofill_used',
  properties: {
    projects_imported: number,
  }
}
```

### 💼 Jobs Events

```typescript
// jobs.viewed
{
  event_name: 'jobs.viewed',
  properties: {
    jobs_count: number,
    filter_applied: Record<string, any>,
  }
}

// jobs.bookmarked
{
  event_name: 'jobs.bookmarked',
  properties: {
    job_id: string,
    company: string,
    role_type: string,
    salary_lpa?: number,
  }
}

// jobs.applied_clicked
{
  event_name: 'jobs.applied_clicked',
  properties: {
    job_id: string,
    company: string,
    job_source: string,
    days_listed: number,
  }
}
```

---

## Funnel Definitions

### Activation Funnel
```
user.signed_up → user.onboarding_completed → chapter.started → chapter.completed (1st)
```

### Conversion Funnel
```
chapter.paywall_hit → commerce.plan_viewed → commerce.order_created → commerce.payment_success
```

### Retention Funnel (Weekly)
```
gamification.streak_extended (any day) → [7 days later] gamification.streak_extended
```

### Referral Funnel
```
referral.link_copied → referral.signup_via_referral → commerce.payment_success (referred user) → referral.commission_credited
```

---

## Implementation

### Frontend SDK (apps/web/src/lib/tracker.ts)
The tracker file exists. Extend it to:
1. Auto-collect context (plan, level, streak) from `useAuth` + `useApiQuery`
2. Batch events every 5 seconds or 10 events (whichever first)
3. Send to `POST /api/analytics/track` with session ID

### Server-Side Events
Events like `gamification.xp_earned`, `referral.commission_credited`, and `commerce.payment_success` should ALWAYS be fired server-side to prevent tampering.
