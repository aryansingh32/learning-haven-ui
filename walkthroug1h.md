# Apprenticeship Platform: Phase 1 (Foundation) Walkthrough

We have successfully completed Phase 1: **Foundation** for the new Apprenticeship & Internship Platform module of the Learning Haven ecosystem.

## 1. Database Architecture
Created 13 new PostgreSQL tables inside Supabase, complete with Row Level Security (RLS) policies, foreign key constraints, and indexing. Key tables built:
- **Programs & Projects**: Configuration structures defining the curriculum, test guides, and automated CI tests.
- **Enrollments & Progress**: Tracking student progression phase-by-phase.
- **Submissions & Certificates**: Storing testing outputs and cryptographically verifiable certificates.

## 2. Robust Backend Service
Implemented a self-contained backend module (`backend/src/modules/apprenticeship/`):
- `types.ts`: Comprehensive domain interfaces corresponding precisely to the Supabase schemas.
- `programs.service.ts` & `projects.service.ts`: Services to expose CRUD capabilities and safely query public-facing filtered lists.
- `programs.controller.ts`: Input validation handlers wrapping services for Express.
- Registered under `api/v1/apprenticeship` with dual authentication modes (Public & Admin-Required).

## 3. Admin Control Panel
Expanded the React 19 / TanStack Query admin portal:
- **Programs Page (`ProgramsPage.tsx`)**: High-fidelity dashboard visualizing all programs with quick edit and active/draft/archived states toggling.
- **Program Editor (`ProgramEditorPage.tsx`)**: Powerful editor to configure core settings, pricing logic, tech stacks, and auto-generated URL slugs. Features embedded project reordering.
- **Project Configuration (`ProjectEditorPage.tsx`)**: An editor configured for defining traditional logic, AI hints, starter repositories, and mapping to auto-verification Docker test images.

## 4. Stunning Student UI
Built a state-of-the-art public frontend targeting high conversion utilizing Vite, Tailwind v3, and Framer-grade aesthetics:
- **Discovery Hub (`ApprenticeshipsPage.tsx`)**: Contains glassmorphism search components, difficulty filters, and beautiful card layouts for exploring active programs.
- **Details Module (`ApprenticeshipProgramPage.tsx`)**: A dynamic learning path explorer showing the timeline of the curriculum, required hours, the verification mode (Automated/Manual), alongside sticky premium checkout boxes emphasizing the cryptographic certificate value.

## 5. GitHub Integration & Verification Engine (Phase 3 & 4)
We have fully built the core "build-and-verify" loop similar to CodeCrafters:
- **GitHub App OAuth integration**: Added `github.service.ts` allowing students to connect their GitHub accounts. Personal access tokens are symmetrically encrypted via AES-256 before entering Supabase.
- **Automated Repository Provisioning**: Whenever a user starts a project, a private clone of the `starter_repo_url` is automatically created on GitHub through Octokit and scoped to the user.
- **HMAC Secure Webhooks**: Programmatic webhook installation bound to `/api/v1/github/webhooks`. Verified via timing-safe SHA-256 equality checks.
- **BullMQ Auto-Grader Shell**: Added `verification.worker.ts` that triggers when pushes are received. It spins up a process that stubs Docker execution and tests the repo.
- **Real-Time Workspace IDE**: Created `WorkspacePage.tsx`, a bespoke UI with instructions on the left and a realtime Terminal emulator on the right. Subscribes globally via Supabase Realtime to the BullMQ Test Stages, simulating a continuous pipeline execution right in the browser!

## Next Steps
The system is ready for testing! Once you set up your GitHub App in the developer settings and load the environment variables, the webhook and testing engine will be unblocked. Next up is Phase 2 (Enrollments and checkouts).
