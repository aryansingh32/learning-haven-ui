# Queue Outage Runbook

1. Confirm Redis availability and queue depth from `/metrics`/Grafana.
2. Inspect `build-verification-dlq` and `apprenticeship-verification-dlq`.
3. Pause queue producers if failures are caused by downstream services.
4. Replay jobs only after the root cause is fixed.
5. Keep failed job payloads for incident review.
