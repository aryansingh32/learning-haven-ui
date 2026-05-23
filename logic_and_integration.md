# Learning Haven - Logic & Integration Audit (SaaS Report)

## 1. System Integration Architecture
The platform is a multi-tier SaaS ecosystem with deep integration between authentication, educational content, gamification, and monetization.

### Data Flow Overview
1.  **Frontend (React)**: User interactions and state management via TanStack Query.
2.  **Backend (Express)**: Orchestrates business logic, gated content, and AI interactions.
3.  **Database (Supabase/Postgres)**: Central source of truth for user profiles, progress, and schema configuration.
4.  **External Services**:
    -   **OpenAI**: Powers the AI Coach.
    -   **Razorpay**: Handles all currency transactions.
    -   **Supabase Auth**: Manages JWT-based secure sessions.

---

## 2. Core Business Logics

### A. Learning Progression & Content Unlocking
The platform uses a "Strict Linear Achievement" model to ensure pedagogical quality.
- **Micro-Tracking**: Every step (Video, Article, Task) within a Chapter is tracked in `user_progress`.
- **The Completion Gate**: To unlock the next chapter, a user must:
    -   Achieve a minimum **66% Score** on the Chapter Quiz.
    -   Complete at least **1 Hands-on Task**.
- **Skip Tokens**: A premium economy feature allowing users to bypass the gate using skip tokens, marking the chapter as `COMPLETED` and unlocking the next immediately.

### B. Gamification & Engagement (XP System)
Designed to drive daily active usage (DAU).
- **XP Scaling**:
    - `Easy`: 10 XP | `Medium`: 25 XP | `Hard`: 50 XP.
    - `First Solve Bonus`: +5 XP.
- **Streak System**:
    -   **Daily Maintenance**: User must solve at least one problem to maintain streak.
    -   **Streak XP Bonus**: `days * 2` (capped at 50 XP per session).
- **Progression**: 15 levels of mastery with exponential XP requirements, driving long-term retention.

### C. Viral Growth Engine (Referrals)
A robust SaaS referral system built into the core.
- **Wallet Integration**: Successful referrals credit the referrer's virtual wallet (default ₹100).
- **Fraud Engine**: Calculates a "Fraud Score" based on IP addresses and device fingerprints. Scores >70 block auto-activation.
- **Activation Logic**: Referrals are only "Paid" once the referred user makes their first purchase, ensuring high-quality traffic.

---

## 3. Database Schema Design (SaaS Best Practices)
The schema is highly optimized for performance and scalability.

| Table Category | Key Tables | Purpose |
| :--- | :--- | :--- |
| **Identity** | `public.users` | Centralized profile with gamification stats and referral metadata. |
| **Content** | `chapters`, `steps`, `problems` | Hierarchical learning structure with JSONB for dynamic content data. |
| **Progress** | `user_chapter_progress`, `user_progress` | Gated status tracking for every user-content interaction. |
| **Economy** | `payments`, `subscriptions`, `withdrawals` | Multi-currency (INR) tracking with Razorpay integration. |
| **AI** | `ai_chats` | Traceable AI interaction history and token usage tracking. |

---

## 4. Operational Flow (User Journey)

### Step 1: Onboarding
- Signup triggers referral validation and IP logging.
- `onboarding_answers` stored to personalize the roadmap.

### Step 2: Active Learning
- User explores Roadmaps -> Chapters -> Steps.
- Video/Article consumption updates `user_progress`.
- Quiz/Task completion updates `user_chapter_progress` status to `COMPLETED`.

### Step 3: Practice & AI
- Solving problems gains XP -> `calculateLevel()` triggers on profile refresh.
- AI Coach usage consumes `doubt_queries_used` (gated by subscription plan).

### Step 4: Achievement & Payoff
- Chapter completion generates dynamic certificates.
- Referral viral loop (Users share links to earn wallet balance).

---

## 5. Professional Recommendations

1.  **Automated Streak Protection**: Consider adding a "Streak Freeze" item in the virtual shop to increase user engagement and spend.
2.  **Advanced Fraud AI**: While IP/Fingerprint checks are good, adding behavioral analysis (time between signup and referral) would further harden the referral system.
3.  **Real-Time Progress**: Using Supabase Realtime for `user_chapter_progress` would allow for "Live Updates" in multi-device scenarios (e.g., watching video on mobile, taking quiz on PC).
