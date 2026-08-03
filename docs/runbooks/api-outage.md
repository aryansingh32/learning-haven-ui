# API Outage Runbook

1. Check `/api/health` and `/metrics`.
2. Verify the latest deployment and error rate in Grafana.
3. Check required environment variables validated by `apps/api/src/config/env.ts`.
4. Inspect API logs for `INTERNAL_SERVER_ERROR`, startup env validation failures, and Redis/Postgres connection errors.
5. Roll back the API deployment if error rate remains elevated after config and dependency checks.
