# Observability

## Metrics Endpoint

The API exposes Prometheus text metrics at `/metrics`.

If `METRICS_SECRET_TOKEN` is set, callers must pass:

```text
Authorization: Bearer <token>
```

Current metrics include:

| Metric | Purpose |
| --- | --- |
| `learning_haven_process_uptime_seconds` | API uptime |
| `learning_haven_http_requests_total` | Request count by route |
| `learning_haven_http_errors_total` | 5xx count by route |
| `learning_haven_http_latency_ms` | p50, p95, p99 latency by route |

## Alert Thresholds

| Signal | Critical Threshold |
| --- | --- |
| API 5xx rate | > 2 percent for 5 minutes |
| p95 latency | > 1500 ms for 10 minutes |
| Queue DLQ entries | Any new terminal failure |
| Redis downtime | Any failed health check |
| Webhook errors | > 5 percent failed deliveries |
