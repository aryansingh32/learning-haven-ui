# Redis Outage Runbook

1. Check Redis process/container health and network reachability.
2. Expect degraded cache, rate limiter, and BullMQ behavior while Redis is down.
3. Restart workers after Redis recovery if BullMQ connections remain stale.
4. Review queue depths and DLQ entries after recovery.
