# Learning Haven Apprenticeship Platform

This folder packages the apprenticeship and internship module as a standalone slice that can be integrated into the main Learning Haven ecosystem.

Included:

- `supabase/migrations/20260428_apprenticeship_platform.sql`
- `.env.example`

Runtime integration points already wired in this repo:

- Backend routes: `backend/src/modules/apprenticeship`
- GitHub integration: `backend/src/modules/github`
- Verification worker: `backend/src/workers/verification.worker.ts`
- Student UI: `src/pages/Apprenticeship*.tsx`, `src/pages/WorkspacePage.tsx`
- Admin UI: `admin/src/pages/apprenticeship/*`

Current implementation intentionally excludes payment execution flows. The schema keeps payment hooks and fields so Razorpay can be layered back in without another data model change.
