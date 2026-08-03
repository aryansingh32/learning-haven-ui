# Release And Rollback Plan

## Database

1. Take a backup before every schema migration.
2. Apply migrations in timestamp order.
3. Verify row counts, indexes, and RLS policies.
4. Keep feature flags disabled until data verification passes.
5. Roll back by restoring the pre-migration backup if a destructive data issue is found.

## Feature Flags

1. Enable at 0 percent for smoke testing.
2. Roll out to 5 percent, 25 percent, 50 percent, and 100 percent.
3. Disable immediately if errors, latency, or support issues spike.

## API Deployment

1. Deploy API with env validation enabled.
2. Check `/api/health`, `/metrics`, login, enrollment, submission, payment, and webhook smoke tests.
3. Roll back to the previous image if P0 paths fail.

## Backup Validation

Daily backup validation must restore into an isolated database and run:

```sql
select count(*) from users;
select count(*) from programs;
select count(*) from program_enrollments;
select count(*) from program_submissions;
```
