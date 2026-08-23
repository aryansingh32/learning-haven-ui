# CANONICAL LEARNER MODEL — Learning Haven / FORGE
## The Complete Learner State Specification

This document defines the authoritative learner model — every piece of state that defines a learner, their career progress, learning journey, and engagement. This is the source of truth for features, AI, analytics, and gamification.

---

## 1. Core Identity

```typescript
interface LearnerCore {
  // Authentication
  id: string;              // UUID (Supabase auth UID)
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'free' | 'admin' | 'super_admin';  // Platform role, NOT plan
  created_at: Date;
  
  // Plan / Entitlements
  current_plan: string;          // plan slug: 'free' | 'basic' | 'standard' | 'pro'
  active_subscription_id?: string;
  plan_expires_at?: Date;        // null = lifetime or free
  
  // Gamification State
  xp: number;                    // Total XP earned lifetime
  level: number;                 // Derived: calculateLevel(xp)
  streak: number;                // Days of consecutive activity
  longest_streak: number;        // All-time best streak
  streak_freeze_count: number;   // Remaining streak freezes
  
  // Career
  career_track?: string;         // 'backend' | 'frontend' | 'fullstack' | 'dsa' | 'ml'
  target_role?: string;          // e.g., "SDE-2 at Product Company"
  onboarding_completed: boolean;
  onboarding_answers?: Record<string, any>;
  
  // Wallet
  wallet_balance: number;        // Paise (referral earnings)
  total_referral_earnings: number;
  
  // Meta
  phone?: string;
  study_time_total: number;      // Seconds
  last_study_session?: Date;
  referred_by?: string;          // Referrer user ID
}
```

---

## 2. XP & Leveling System

```typescript
// Current XP thresholds (from utils/xp.ts)
// Level = floor(sqrt(xp / 100))
// e.g., Level 5 = 2500 XP, Level 10 = 10000 XP, Level 20 = 40000 XP

interface XPLedgerEntry {
  id: string;
  user_id: string;
  amount: number;                // XP delta (positive = earned, negative = consumed)
  reason: XPReason;
  source_id?: string;            // ID of the triggering entity
  source_type?: 'chapter' | 'problem' | 'challenge' | 'referral' | 'daily_quest' | 'streak';
  created_at: Date;
}

type XPReason =
  | 'chapter_complete'
  | 'problem_solved'
  | 'daily_quest_complete'
  | 'streak_bonus'
  | 'build_challenge_complete'
  | 'apprenticeship_project'
  | 'referral_bonus'
  | 'admin_grant';

// XP Values (from GamificationConfig defaults)
const XP_VALUES = {
  chapter_complete: 150,          // Per chapter completed
  easy_problem_solved: 10,
  medium_problem_solved: 25,
  hard_problem_solved: 50,
  daily_quest_complete: 50,       // Per quest
  streak_7day_bonus: 200,
  streak_30day_bonus: 500,
  build_challenge_stage: 100,     // Per build stage completed
  apprenticeship_project: 250,
};
```

---

## 3. Learning Journey State

```typescript
interface LearnerCourseProgress {
  // Course enrollment (derived from chapters)
  enrolled_course_id?: string;
  course_title?: string;
  
  // Chapter-level
  chapters: ChapterProgress[];
  completed_count: number;
  total_count: number;
  progress_percent: number;       // 0-100
  active_chapter?: ChapterProgress;
  
  // Step-level (within active chapter)
  current_step_index: number;
  steps_completed: number[];
}

interface ChapterProgress {
  id: string;
  chapter_number: number;
  title: string;
  topic_tag?: string;             // 'arrays' | 'dp' | 'graphs' | etc.
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completed_steps: number;
  total_steps: number;
  unlocked: boolean;              // Based on entitlement check
  xp_reward: number;              // From backend config, NOT hardcoded formula
  estimated_minutes: number;
}

interface ProblemSolvingState {
  total_solved: number;
  total_tried: number;
  total_revision: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  
  // Topic-level mastery (used by Knowledge Map and AI Coach)
  topic_progress: TopicProgress[];
}

interface TopicProgress {
  topic: string;                  // 'Arrays' | 'Dynamic Programming' | etc.
  total: number;
  solved: number;
  progress: number;               // 0-100 weighted by difficulty
  proficiency: number;            // 0-100 spaced-repetition-aware score
}
```

---

## 4. Identity & Badges

```typescript
interface LearnerIdentity {
  // Dynamic identity title (changes with level + mastery)
  identity: {
    id: string;
    title: string;                // e.g., "Array Slayer", "Graph Wizard", "DP Guru"
    minLevel: number;
    maxLevel: number;
  };
  
  // Earned badges
  badges: Badge[];
}

interface Badge {
  badge_id: string;
  badge_name: string;
  badge_emoji: string;
  earned_at: Date;
  criteria?: string;
}

// Identity titles are configurable via admin panel → GamificationSettings
// Resolution logic: level range + required chapter topic tags
```

---

## 5. Daily Quests & Missions

```typescript
interface DailyQuests {
  date: string;                   // YYYY-MM-DD in IST
  quests: Quest[];
  total_xp_available: number;
  total_xp_earned: number;
  all_complete: boolean;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'solve_problems' | 'study_chapter' | 'streak' | 'ai_query';
  target: number;                 // e.g., solve 3 problems
  current: number;                // Current progress
  xp_reward: number;
  completed: boolean;
  completed_at?: Date;
}

interface Mission {
  // The learner's current big-picture goal
  title: string;                  // e.g., "Complete Phase 1: Foundations"
  description: string;
  phase: number;
  progress_percent: number;
  days_remaining?: number;
  next_milestone: string;
}
```

---

## 6. Career Readiness (Canonical Computation)

> **CRITICAL:** Career readiness MUST be computed server-side, not in `RoadmapContext.tsx`. The current frontend computation is unreliable.

```typescript
interface CareerReadiness {
  readinessPercent: number;       // 0-100 composite score
  targetRole: string;             // e.g., "SDE-1 at FAANG"
  salaryBand: string;             // e.g., "₹12-18 LPA"
  
  // Component scores
  dsa_score: number;              // 0-100, from problem solving
  project_score: number;          // 0-100, from build challenges
  system_design_score: number;    // 0-100, from chapters
  soft_skills_score: number;      // 0-100, from apprenticeship
  
  skillsLearned: number;          // Count of distinct topic tags with >50% progress
  projectsBuilt: number;          // Count of completed build stages
  skillsMissing: string[];        // Topic tags needed for target role but <30% proficiency
  
  // Momentum
  velocity: number;               // XP earned this week vs last week
  consistency: number;            // Days active / 30
}

// Computation endpoint: GET /api/users/me/career-readiness
// Should read from: users, user_problem_status, build_enrollments, apprenticeship_project_progress
```

---

## 7. AI Mentor Context

```typescript
interface MentorContext {
  // Learning state
  context: {
    courseTitle?: string;
    activeChapter?: string;
    lastCompletedChapter?: string;
    streak: number;
    daysInactive?: number;
    weakTopics: string[];         // Topics with <30% proficiency
    strongTopics: string[];       // Topics with >70% proficiency
    xp: number;
    level: number;
    problemsSolvedThisWeek: number;
  };
  
  // Behavioral trigger
  scenario: 'streak_at_risk' | 'just_completed' | 'stuck' | 'new_learner' | 'returning' | 'milestone_near';
  message: string;                // Suggested mentor nudge
  
  // Proactive suggestions
  suggested_topics: string[];
  suggested_problems: string[];
}
```

---

## 8. Entitlement State (What the Learner Can Access)

```typescript
interface LearnerEntitlementMap {
  // Feature access
  chapters_access: { allowed: boolean };
  problem_access: { allowed: boolean };
  ai_queries_per_day: { allowed: boolean; limit: number; used: number; remaining: number };
  resume_builder: { allowed: boolean };
  certificates_access: { allowed: boolean };
  job_alerts: { allowed: boolean };
  whatsapp_tasks: { allowed: boolean };
  challenge_limit: { allowed: boolean; limit: number; used: number };
  skip_tokens: { allowed: boolean; limit: number };
  
  // Content resource access (per item)
  course_access?: { allowed: boolean; resource_id: string };
  apprenticeship_access?: { allowed: boolean; resource_id: string };
  
  // Plan metadata
  _plan: {
    slug: string;
    name: string;
    periodEnd?: Date;
  };
}
```

---

## 9. Build Haven State

```typescript
interface BuildHavenEnrollment {
  id: string;
  program_id: string;
  program_title: string;
  language: string;               // 'javascript' | 'python' | 'java'
  challenge_mode: 'traditional' | 'vibe';
  
  current_stage: number;
  total_stages: number;
  progress_percent: number;
  
  github_repo_url?: string;
  github_repo_name?: string;
  last_commit_sha?: string;
  
  enrolled_at: Date;
  updated_at: Date;
}

interface BuildStageProgress {
  stage_number: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
  attempts: number;
  test_results?: {
    passed: number;
    total: number;
    output: string;
  };
  xp_earned: number;
  completed_at?: Date;
}
```

---

## 10. Referral & Wallet State

```typescript
interface ReferralState {
  referral_code: string;
  is_custom_code: boolean;
  
  // Wallet
  wallet_balance: number;         // Paise (e.g., 10000 = ₹100)
  total_referral_earnings: number;
  
  // Referrals
  referrals: ReferralRecord[];
  referral_count: number;
  active_count: number;
  pending_count: number;
  
  // Tier (computed server-side)
  current_tier: {
    name: 'Bronze' | 'Silver' | 'Gold';
    commission_pct: number;
    min_referrals: number;
    max_referrals?: number;
  };
}

interface ReferralRecord {
  id: string;
  referred_user: { full_name: string; id: string };
  status: 'pending' | 'active' | 'expired' | 'suspicious';
  reward_amount: number;          // Paise earned for this referral
  created_at: Date;
  credit_eligible_at?: Date;      // When the commission will be credited
}
```

---

## 11. Activity & Analytics

```typescript
interface ActivityHeatmap {
  // Data points, one per active day
  entries: Array<{
    date: string;                 // YYYY-MM-DD
    count: number;                // Activities that day
    level: 0 | 1 | 2 | 3 | 4;   // Intensity bucket
  }>;
}

// Tracked activities that generate heatmap points:
// - Problem solved
// - Chapter step completed
// - Build stage submitted
// - AI query sent
// - Daily quest completed
```

---

## Implementation Notes for Engineers

1. **XP Ledger:** The `xp_ledger` migration (20260823) exists but the service writes directly to `users.xp`. Complete the migration by reading from the ledger for auditability.

2. **Career Readiness:** Move all computation from `RoadmapContext.tsx` to `GET /api/users/me/career-readiness`. Frontend becomes a pure display layer.

3. **Quiz Answers:** NEVER send `correctIndex` or `correctAnswer` to the frontend. Use a server-side check endpoint.

4. **Streak Logic:** Ensure streak cron job runs at midnight IST (not UTC). Use the `todayIST()` pattern already established in `entitlements.service.ts`.

5. **Level Cache:** Cache `calculateLevel(xp)` result in `users.level` column and update it whenever XP changes, to avoid re-computation on every profile read.
