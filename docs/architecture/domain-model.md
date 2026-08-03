# Learning Haven Domain Model

## Single Source Of Truth

Learning Haven now treats `programs` as the shared domain for Build Haven, Apprenticeship, courses, and future career tracks.

```text
User
  -> program_enrollments
  -> program_submissions
  -> program_reviews
  -> program_certificates

Program
  -> program_stages
  -> program_enrollments
  -> program_submissions
  -> program_reviews
  -> program_certificates

Category
  -> programs
  -> problems
  -> courses
```

## Ownership Map

| Domain | Owner Module | Database Tables |
| --- | --- | --- |
| Auth and profile | `modules/auth` | `users`, auth provider tables |
| Program catalog | `modules/learning`, `modules/build-haven`, `modules/apprenticeship` | `programs`, `program_stages` |
| Enrollment | `modules/apprenticeship`, `modules/build-haven` | `program_enrollments` |
| Submission and verification | `modules/execution`, `modules/github` | `program_submissions`, queue tables |
| Certificates | `modules/learning` | `program_certificates` |
| Admin operations | `modules/admin` | `admin_audit_logs`, `feature_flags` |
| Commerce | `modules/billing` | plans, payments, purchases, idempotency keys |

## Legacy Mapping

| Legacy Table | Unified Table | Notes |
| --- | --- | --- |
| `build_challenges` | `programs` | `type = build_haven` |
| `build_stages` | `program_stages` | Preserves Docker/test metadata in `content` |
| `build_enrollments` | `program_enrollments` | Migrated behind `new_enrollment_system` flag |
| `build_stage_results` | `program_submissions` | Migrated behind `new_submission_system` flag |
| `apprenticeship_projects` | `program_stages` | Future migration uses `type = apprenticeship` |
| `apprenticeship_enrollments` | `program_enrollments` | Future migration uses same enrollment engine |
| `apprenticeship_submissions` | `program_submissions` | Future migration uses same submission engine |

## Migration Strategy

1. Keep legacy writes active.
2. Enable dual-write behind feature flags.
3. Verify row counts and sampled business invariants.
4. Switch reads to unified tables by feature flag.
5. Remove legacy tables only after backup and rollback validation.
