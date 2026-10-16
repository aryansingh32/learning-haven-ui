# Incident response

For anything that may expose personal data, money or exam results, or take Forge down.

## Severity

| Level | Examples | Response |
|---|---|---|
| SEV-1 | Personal data exposed; payments or results tampered with; full outage | Start now, all hands, notify owners within 1 hour |
| SEV-2 | One feature down for everyone; a suspected breach not yet confirmed | Start within 1 hour |
| SEV-3 | Degraded service; a vulnerability reported but not exploited | Same working day |
| SEV-4 | Minor bug with a security angle | Normal backlog |

## Steps

1. **Detect and declare** — name an incident lead and open one channel and one timeline document.
2. **Contain** — use the admin Control Centre: maintenance mode, or switch off the affected module (AI, code
   runs, purchases, test series, discussions, community). Suspend abusing accounts (Users → bulk suspend).
   Rotate any exposed key (Supabase service role, Razorpay, Resend, AI providers, JWT secret).
3. **Preserve evidence** — export admin audit logs, device and sign-in records, API logs and Sentry events for
   the window. Don't delete accounts or rows that may be evidence.
4. **Eradicate and recover** — fix, add a test that fails without the fix, deploy, verify on live; restore
   from point-in-time backup if data was altered.
5. **Notify** (personal data incidents):
   - **CERT-In**: report cyber security incidents of the listed kinds within **6 hours** of noticing them
     (CERT-In directions, April 2022).
   - **Data Protection Board of India and affected people**: inform without delay under the DPDP Act 2023 and
     its rules, with a detailed report within the period the rules set (72 hours).
   - **Colleges**: tell each affected college's owner the same day; their data processing agreement may set
     shorter terms.
   - **EU/UK users** (if any): GDPR Art. 33, supervisory authority within 72 hours.
6. **Review** within 5 working days: timeline, root cause, what we change.

## Contacts

Fill in before launch: incident lead, owner, hosting/Supabase admin, payments admin, legal contact.
