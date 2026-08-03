# Database Outage Runbook

1. Confirm `DATABASE_URL`, PgBouncer, and Supabase project status.
2. Check pool saturation, connection timeout, and query latency metrics.
3. Stop non-critical workers if write pressure is increasing.
4. Restore from the latest verified backup only after identifying data corruption or unrecoverable migration failure.
5. For migration rollback, use the deployment rollback plan and restore from the pre-migration backup.
