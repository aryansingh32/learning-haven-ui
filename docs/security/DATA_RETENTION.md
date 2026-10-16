# Data retention (proposed — confirm with legal before launch)

| Data | Kept | Then |
|---|---|---|
| Account, profile, progress, certificates | While the account exists | Deleted with the account (cascade) |
| Payments and GST invoices | 8 years (Indian tax law) | Deleted or anonymised |
| Device records (`user_devices`) | 180 days after last seen | Deleted by a scheduled job |
| Sign-in records (`account_events`) | 1 year | Deleted |
| Exam webcam photos (`campus.proctoring_snapshots`, only on tests that turn them on, with consent) | 90 days | Deleted by the same scheduled job |
| Exam attempts, proctoring events, device of attempt | As long as the college keeps the result (default 3 years) | Deleted with the attempt |
| Admin audit logs | 2 years | Deleted |
| Analytics events | 13 months | Aggregated, then deleted |
