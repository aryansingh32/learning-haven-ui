# Backend Architecture Standards

## Layering Rule

All API modules must follow this dependency direction:

```text
Controller -> Service -> Repository -> Database
```

Controllers may validate HTTP input, call services, and format responses. Controllers must not contain SQL, Supabase query chains, payment provider calls, queue orchestration, or long-running business logic.

## API Contract

Every endpoint must return one of these shapes:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

Use `utils/api-response.ts` helpers for new code.

## Validation

Every route that consumes `body`, `query`, or `params` must use `middleware/validate.ts` with a source-specific Zod schema before business logic executes.

## Write Safety

High-risk writes must use:

| Operation | Required Controls |
| --- | --- |
| Payments | Auth, rate limit, idempotency, webhook signature |
| Enrollments | Auth, rate limit, idempotency |
| Submissions | Auth, rate limit, idempotency |
| Certificates | Auth, rate limit, idempotency |
| Webhooks | Signature validation, rate limit, idempotency |

## Operational Requirements

All outbound integrations must have timeouts and circuit breakers. Queue producers must set retry/backoff policies. Workers must capture terminal failures in dead-letter queues.
