# Webhook Outage Runbook

1. Verify webhook signature secrets and provider delivery logs.
2. Check webhook rate limits and idempotency conflicts.
3. Inspect GitHub/Razorpay delivery IDs and replay failed provider events.
4. Confirm duplicate events return cached idempotent responses.
