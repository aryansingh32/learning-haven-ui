# Implementation Plan V2 - Enterprise Production Hardening, Architecture Consolidation & Launch Readiness

This plan defines the complete transformation of `learning-haven-ui` into a production-grade platform following standards used by large-scale engineering organizations.

Goal:

* Eliminate architectural debt
* Establish Single Source of Truth
* Remove duplicated business logic
* Achieve production-grade reliability
* Achieve production-grade observability
* Achieve production-grade testing
* Achieve production-grade security
* Achieve production-grade operational readiness
* Prepare for future scaling

---

# User Review Required

## Domain Model Consolidation

Current State:

```text
Build Haven

build_stages
build_enrollments
build_stage_results

Apprenticeship

apprenticeship_projects
apprenticeship_enrollments
apprenticeship_submissions
```

Proposed State:

```text
Program

Program Type
Program Stage
Program Enrollment
Program Submission
Program Review
Program Certificate
```

Unified Tables:

```sql
programs
program_stages
program_enrollments
program_submissions
program_reviews
program_certificates
```

Benefits:

* One progression engine
* One enrollment engine
* One submission engine
* One analytics engine
* One admin workflow
* One future scaling path

---

## Feature Flag Strategy

No major migration will be executed without feature flags.

New Table:

```sql
feature_flags

id
key
enabled
rollout_percentage
description
created_at
updated_at
```

Initial Flags:

```text
unified_programs
new_category_fk
new_submission_system
new_enrollment_system
new_certificate_system
```

Migration Strategy:

```text
Legacy Write
      ↓
Dual Write
      ↓
Data Verification
      ↓
Read Switch
      ↓
Legacy Removal
```

---

## Security Review Required

Immediate Actions:

* Revoke all checked-in secrets
* Rotate OpenRouter keys
* Rotate Supabase service keys
* Rotate GitHub tokens
* Rotate SMTP credentials
* Move all secrets to environment variables

---

# Open Questions

1. Is any production data already using build_haven and apprenticeship simultaneously?

2. Do certificates need historical immutability?

3. Do we need audit retention for compliance purposes?

4. Should all code execution be fully isolated with no network access?

5. Are future program types expected beyond Build and Apprenticeship?

6. Should soft deletes be standardized to deleted_at globally?

---

# Phase 0 — Architecture Redesign

Goal:

Define proper business architecture before changing tables.

---

## Component 0.1 Domain Mapping

### [NEW] docs/architecture/domain-model.md

Create complete domain architecture:

```text
User
 ├── Program Enrollment
 ├── Submission
 ├── Review
 ├── Certificate

Program
 ├── Stage
 ├── Enrollment
 ├── Submission
 ├── Review
 ├── Certificate

Category
 ├── Problems
 ├── Programs
 ├── Resources
```

Deliverables:

* Entity relationship diagram
* Ownership map
* Single source of truth map

---

## Component 0.2 Architecture Standards

### [NEW] docs/architecture/backend-standards.md

Define:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

Forbidden:

```text
Controller
    ↓
Database
```

---

# Phase 1 — Testing Foundation

Goal:

Zero critical flow may exist without tests.

---

## Component 1.1 Test Infrastructure

### [NEW] apps/api/jest.config.ts

Configure:

* Jest
* ts-jest
* coverage
* setup hooks

---

### [MODIFY] package.json

Install:

```bash
jest
ts-jest
supertest
@types/jest
@types/supertest
```

---

## Component 1.2 Critical Path Tests

### [NEW] auth.test.ts

Test:

* signup
* login
* logout
* refresh token
* forgot password

---

### [NEW] enrollment.test.ts

Test:

* enroll
* duplicate enroll
* cancel
* complete

---

### [NEW] submission.test.ts

Test:

* submit
* resubmit
* invalid submission
* permission checks

---

### [NEW] certificate.test.ts

Test:

* issue
* revoke
* verify
* download

---

### [NEW] admin.test.ts

Test:

* user management
* role changes
* moderation
* audit logs

---

### [NEW] webhook.test.ts

Test:

* github webhook
* duplicate webhook
* invalid webhook

---

# Phase 2 — Validation & API Standardization

Goal:

Every request validated before business logic.

---

## Component 2.1 Global Validation

### [NEW] middleware/validate.ts

Implement:

```ts
validate(schema)
```

All routes must use it.

---

## Component 2.2 Response Standardization

### [NEW] utils/api-response.ts

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "",
    "message": ""
  }
}
```

---

## Component 2.3 Error Middleware

### [MODIFY] app.ts

Standardize:

* 400
* 401
* 403
* 404
* 409
* 422
* 500

---

# Phase 3 — Database Consolidation

Goal:

Single source of truth.

---

## Component 3.1 Program Migration

### [NEW] 20260606000001_unify_programs.sql

Create:

```sql
programs
program_stages
program_enrollments
program_submissions
program_reviews
program_certificates
```

---

### Data Migration

Move:

```text
build_stages
→ program_stages

apprenticeship_projects
→ program_stages
```

Move:

```text
build_enrollments
→ program_enrollments

apprenticeship_enrollments
→ program_enrollments
```

Move:

```text
build_stage_results
→ program_submissions

apprenticeship_submissions
→ program_submissions
```

---

## Component 3.2 Category FK Migration

### [NEW] 20260606000002_category_fk.sql

Replace:

```sql
topic TEXT
```

With:

```sql
category_id UUID
```

---

## Component 3.3 Soft Delete Standardization

Standard:

```sql
deleted_at TIMESTAMP
```

Remove:

```text
is_deleted
is_archived
inactive
```

where possible.

---

# Phase 4 — Security Hardening

Goal:

Production-safe security posture.

---

## Component 4.1 Secret Management

Move all secrets to:

```text
.env
vault
secret manager
```

---

## Component 4.2 Rate Limiting

Protect:

* login
* register
* OTP
* submissions
* AI endpoints

---

## Component 4.3 Idempotency

### [NEW] idempotency_keys

```sql
id
key
request_hash
response
expires_at
```

Protect:

* enrollments
* submissions
* certificates
* payments
* webhooks

---

# Phase 5 — Reliability

Goal:

System survives failures.

---

## Component 5.1 Circuit Breakers

### [NEW] infrastructure/circuit-breakers

Protect:

* GitHub
* OpenRouter
* Razorpay
* Email

---

## Component 5.2 Timeouts

Enforce:

```text
connect timeout
read timeout
write timeout
```

---

## Component 5.3 Queue Hardening

BullMQ:

```text
retry policy
backoff policy
dead letter queue
failure queue
```

---

## Component 5.4 Job Replay

Admin can:

* view failed jobs
* retry jobs
* inspect errors

---

# Phase 6 — Observability

Goal:

No blind spots.

---

## Component 6.1 Metrics

### [NEW] metrics.ts

Track:

* requests/sec
* response time
* p95 latency
* p99 latency
* error rate
* queue depth
* cache hit rate
* db query time

---

## Component 6.2 Prometheus

### [NEW] /metrics endpoint

Expose metrics.

---

## Component 6.3 Grafana Dashboards

Create:

* API dashboard
* DB dashboard
* Queue dashboard
* Cache dashboard

---

## Component 6.4 Alerts

Alert on:

* error spikes
* queue failures
* db latency
* redis down
* webhook failures

---

# Phase 7 — Admin Operations

Goal:

Production operations visibility.

---

## Component 7.1 Audit Logs

### [NEW] admin_audit_logs

```sql
id
admin_id
action
entity_type
entity_id
old_value
new_value
ip_address
timestamp
```

---

## Component 7.2 Feature Flags

Admin can:

* enable
* disable
* percentage rollout

---

## Component 7.3 System Health

Admin dashboard:

* queue status
* db status
* redis status
* api status

---

# Phase 8 — Performance

Goal:

Fast and scalable.

---

## Component 8.1 Query Audit

Review:

* N+1
* joins
* indexes
* query plans

---

## Component 8.2 Pagination

Global limits:

```ts
Math.min(limit, 100)
```

---

## Component 8.3 Cache Strategy

L1:

```text
Memory Cache
```

L2:

```text
Redis
```

L3:

```text
CDN
```

Cache:

* categories
* settings
* plans
* static metadata

---

## Component 8.4 Connection Pooling

Implement:

```text
PgBouncer
```

Review:

* API connections
* worker connections

---

# Phase 9 — Load Testing

Goal:

Discover bottlenecks before users.

---

## Component 9.1 k6 Tests

Scenarios:

* 100 users
* 500 users
* 1000 users
* 5000 users

---

Measure:

* latency
* errors
* queue growth
* db load

---

# Phase 10 — Release Engineering

Goal:

Safe deployments.

---

## Component 10.1 Rollback Plan

Support:

* migration rollback
* feature rollback
* deployment rollback

---

## Component 10.2 Backup Validation

Verify:

* backup creation
* backup restore

---

## Component 10.3 Runbooks

Create:

### docs/runbooks

* API outage
* Redis outage
* DB outage
* Queue outage
* Webhook outage

---

# Verification Plan

## Automated

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

Coverage Target:

```text
Critical Flows: 100%
Backend Overall: 80%+
```

---

## Manual

Verify:

* enrollments
* submissions
* certificates
* feature flags
* audit logs
* queue replay
* rollback

---

## Load Testing

Run:

```bash
k6 run scripts/load-test.js
```

---

## Security Verification

Verify:

* rate limits
* validation
* permissions
* RLS
* secrets

---

# Final Launch Criteria

Launch is allowed only if:

* All P0 issues resolved
* Unified domain model deployed
* Global validation deployed
* Critical tests passing
* Feature flags operational
* Audit logs operational
* Metrics operational
* Alerts operational
* Queue hardening complete
* Idempotency complete
* Rollback tested
* Backup restore tested
* Load tests passed

Status Required Before Release:

```text
SAFE TO SHIP
```
