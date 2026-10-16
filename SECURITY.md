# Security policy

## Reporting a vulnerability

Email **security@forge** (replace with the team's real address before publishing) with the steps to reproduce,
what an attacker could do, and any proof of concept. Please don't open a public issue or test against other
people's accounts or data. We acknowledge reports within 2 working days and aim to fix critical issues within 7 days.

## What we protect and how

| Area | Control |
|---|---|
| Data isolation | Postgres row-level security on every table; college data isolated per college and proven by SQL test suites in CI (`apps/api/supabase/tests`) |
| Learner writes | Learners have no direct write access to accounts, payments, subscriptions, withdrawals, enrolments or results; all writes go through the APIs |
| Authentication | Supabase Auth (bcrypt), signed JWTs verified on every request, session revocation, suspended accounts refused by both APIs |
| Authorisation | Admin routes require admin roles; college routes check per-college permissions; payments check order ownership |
| Abuse | Rate limits on sign-in, OTP, writes, code runs and AI; a per-IP flood ceiling across the API |
| Exams | Server-side grading and timing; attempts bound to their device; integrity signals recorded per attempt |
| Secrets | Environment variables only; API keys never sent to browsers; secret scanning in CI (gitleaks) |
| Outbound requests | Server-side fetches limited to public https hosts (SSRF guard) |
| Dependencies | `pnpm audit` gate (critical) in CI, Dependabot updates, CodeQL static analysis |
| Monitoring | Sentry error tracking, admin audit logs, device and sign-in records |

## Personal data

Forge records, per account: profile, learning progress, payments, sign-ins, and devices (browser, OS, screen,
IP addresses). Exam attempts record the device and network they were taken on. This data is used to run the
product, prevent fraud and keep exams fair. Retention and deletion rules are in `docs/security/DATA_RETENTION.md`.

## Incidents

See `docs/security/INCIDENT_RESPONSE.md`.
