# Local end-to-end stack

## With Docker (preferred, used 2026-10-10 → 2026-10-14)

`npx supabase@2.48.3 start` in a scratch folder (project `forge-demo`) gives Auth, PostgREST and Postgres on
54321/54322; the containers restart with Docker and keep their data. Apply the repo migrations to `54322`, then:
- Keys: the containers don't expose them; mint HS256 JWTs (`role: anon` / `service_role`) with
  `docker exec supabase_auth_forge-demo printenv GOTRUE_JWT_SECRET` (Kong passes JWT api keys through).
- APIs: run each from a scratch folder holding its own `.env` (SUPABASE_URL=http://127.0.0.1:54321, DATABASE_URL on
  54322, local Redis, dummy Razorpay `rzp_test_*`, OPENAI_API_KEY=sk-demo).
- Demo data: `SB_SERVICE_KEY=… SB_ANON_KEY=… node scripts/demo/seed.mjs` (accounts `*@forge.demo`, `*@vit.demo`,
  password Demo@12345; admin@forge.demo should be made `super_admin`).
- Web: `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=… VITE_API_BASE_URL=/api npx vite --port 5173`;
  admin `VITE_API_URL=http://localhost:5000/api` on 5174; portal on 5175.

## Without Docker (browser checks without Supabase)

Used on 2026-10-10 to browser-verify W2-A1 and W2-L1. Nothing here talks to the live project.

| Piece | How |
|---|---|
| Postgres 17 | `/usr/lib/postgresql/17/bin/initdb -D <dir> -U postgres --auth=trust`, start with `pg_ctl -o "-p 55432 -k '' -c listen_addresses=127.0.0.1"` (socket paths in /dev/shm are too long, so TCP only) |
| Database | Same order as live: `tests/fixtures/supabase_stubs.sql`, the snapshot (with `PGOPTIONS='-c search_path=public,extensions'`), `20261008*`, `20261009*`, then `tests/fixtures/missing_on_live.txt`, then the rest. Add the auth tables from the top of `tests/account_profile.sql` (sessions, audit log). |
| REST layer | PostgREST v12 static binary (GitHub release). `db-uri = postgres://authenticator@…` (create `authenticator login noinherit`, grant it anon/authenticated/service_role), `db-schemas = "public"` (same as live), `jwt-secret` = a local test secret. supabase-js calls `<url>/rest/v1/*`, so put a ~10-line Node proxy in front that strips `/rest/v1`. |
| Forge API | Run `tsx apps/api/src/server.ts` **from a scratch folder holding its own `.env`** so the real `apps/api/.env` is not read: `SUPABASE_URL` = the proxy, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` = JWTs `{role}` signed with the test secret, `SUPABASE_JWT_SECRET` = the test secret, `DATABASE_URL` = local, local Redis, dummy Razorpay/GitHub/OpenAI values (`OPENAI_API_KEY` is required, see HANDOFF §8.7). |
| Sign-in | Mint an HS256 access token (`sub`, `email`, `role: authenticated`, `session_id`, `amr`) with the test secret. Web: `localStorage.auth_token`; admin: `localStorage.token`. Seed the user in `auth.users` + `public.users` (`onboarding_completed = true`; `role = 'admin'` for the admin app). |
| Web | `VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_API_BASE_URL=/api npx vite --host 127.0.0.1` (the proxy sends `/api` to `localhost:5000`). Realtime can't connect; that is expected. |
| Browser | Playwright (`playwright-core`) with `/usr/bin/google-chrome`, headless. Abort `unpkg.com` (Monaco) unless needed; allow YouTube only for the video-speed check. |

Expected noise: endpoints that need Supabase Auth or Realtime (sign-in/up, resend email, realtime sockets).
