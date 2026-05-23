# Learning Haven - Referral System Deep-Dive Audit

## 1. Technical Architecture & Logic Gaps

> [!WARNING]
> **Critical Integration Disconnect Found**
> My audit revealed that while the `ReferralsService` is sophisticated, the "Glue Logic" connecting signup to referrals is missing.
> - **Frontend**: The `SignUp` page does not capture the `?ref=` parameter from the URL.
> - **Backend**: The `signup` controller in `auth.controller.ts` does not accept or process a `referralCode` payload.
> - **Fix Required**: Frontend must store the `ref` in `localStorage` on landing, and the Backend `signup` endpoint must be updated to call `ReferralsService.applyReferralCode`.

---

## 2. The Reward Lifecycle

1.  **Application (Pending)**: When a referral is successfully linked (post-signup), it enters a `pending` state. No money is awarded yet.
2.  **Activation (Active)**: Triggered when the referee performs their first "Value Action" (e.g., subscribing to a Pro plan).
3.  **Credit**: The Referrer's `wallet_balance` is updated atomically.
4.  **Withdrawal**: User submits a UPI ID. Balance is deducted immediately to prevent race conditions (double-spending), and the request moves to the Admin Queue.

---

## 3. Fraud Prevention Engine
The system uses a weighted scoring algorithm to maintain economic integrity.

| Risk Factor | Penalty Score | Logic |
| :--- | :---: | :--- |
| **IP Collision** | +40 | Referrer is creating multiple accounts from the same network. |
| **Device Match** | +50 | Referrer is using the same hardware for multiple signups. |
| **Frequency Spike** | +30 | More than 5 referrals in a single hour from one source. |

**Threshold**: Any referral with a **Score >= 70** is flagged as `is_suspicious`. Suspicious referrals are permanently barred from activation.

---

## 4. Database Schema (Economic Objects)

-   **`referrals` Table**:
    -   `referrer_id`: UUID of the sharer.
    -   `referred_user_id`: UUID of the new user.
    -   `status`: `pending`, `active`, `paid`.
    -   `fraud_score`: Numeric risk rating.
-   **`withdrawals` Table**:
    -   Tracks UPI IDs and fulfillment status.

---

## 5. Professional Recommendations

1.  **Immediate Remediation**: Patch the `SignUp` flow to capture and send the `refCode`. Without this, the referral system is currently non-functional for end-users.
2.  **Shadow Bans**: Instead of blocking suspicious signups, let them happen but mark them internally. This prevents "Fraudsters" from learning exactly how to bypass the filters.
3.  **Multi-Tier Rewards**: Implement higher rewards for "Gold" tier referrers (>10 referrals) to incentivize super-users.
