# Backend prompt: Auto-capture ClickPesa loan repayments into Payments

Copy/paste this to the backend team.

---

## Goal

When a customer repays a loan through **ClickPesa BillPay**, Falco must **automatically**:

1. Identify the customer (and their payable loan)
2. Create a payment row via the same path as `POST /payments`
3. Allocate fees → interest → principal
4. Make that payment appear on `GET /payments` (Payments console) without staff using **Record payment**

**Record payment** on the frontend is only a manual fallback (cash / officer collection / independently verified exceptions). It must not be required for normal ClickPesa repayments.

## Expected contract (already documented)

Per `backend-documentation/webhooks-controller.md`:

```
ClickPesa → POST /webhooks/payment?gateway=clickpesa
  event: "PAYMENT RECEIVED"
  data.orderReference  → match payment_references.reference
  data.collectedAmount → payment amount
  → PaymentService posts payment on customer’s payable loan
  → status completed / ledger verified (same as manual POST /payments)
```

No bearer token. Auth is HMAC checksum only.

## Acceptance criteria

1. **Happy path:** Settled ClickPesa BillPay with a valid customer `orderReference` creates a payment visible in `GET /payments` within ~1–2 minutes (or immediately after queue processing), with:
   - correct `customer_id` / customer display
   - correct `loan_id` / loan number
   - amount = collected amount (or documented fee-netting rules)
   - method reflecting mobile money / gateway
   - reference linking to ClickPesa `paymentReference` and/or `orderReference`
   - reconciliation metadata so it does not look “orphaned”
2. **Loan progress updates:** loan `total_paid` / outstanding move so Active Loans `% paid` increases without manual entry.
3. **Idempotent:** duplicate webhooks for the same gateway+reference do **not** double-post payments.
4. **Failure visibility:** if matching or posting fails, `webhook_events` must show `failed` (or equivalent) with a clear `error_message` — never silent drop after ClickPesa SETTLED.
5. **Ops check:** every ClickPesa SETTLED collection for a known Falco payment reference has either:
   - a matching Falco payment, or
   - a failed/unmatched webhook event staff can investigate/retry.

## Known production gap to fix

Settled ClickPesa collections have appeared in the ClickPesa merchant dashboard with **no** matching Falco payment, cashbook entry, or webhook failure visible to ops (see prior brief `docs/Falco-ClickPesa-Webhook-Issue.pdf`).

Please verify and harden, in order:

| # | Check | Required outcome |
| --- | --- | --- |
| A | ClickPesa webhook URL points at production Falco `POST /webhooks/payment?gateway=clickpesa` | Deliveries reach Falco |
| B | HMAC validation accepts ClickPesa’s real payload shape | Valid events return 200 and are logged |
| C | Invalid checksum still leaves an auditable trail (or ClickPesa retry) | No silent discard without ops signal |
| D | `data.orderReference` matches `payment_references.reference` for every BillPay customer | Customer resolved |
| E | Payable loan selection rules when customer has 0 / 1 / many active loans | Deterministic loan pick or explicit fail |
| F | `ProcessWebhookEvent` queue workers are running in production | Pending events process |
| G | Posted payments appear in `GET /payments` with customer+loan populated | Frontend list fills automatically |

## API / data requirements for frontend

Frontend already lists whatever `GET /payments` returns. For auto rows please ensure:

- `status` maps to frontend `completed` when verified (existing contract)
- `loan_id`, customer identity, `amount`, `payment_method` / channel, `reference_number` (or gateway refs) are present
- optional but useful: `source: "clickpesa_webhook"` (or similar) so UI can label **Gateway (Auto)**
- webhook health/retry endpoints remain usable when posting fails

## Out of scope for this request

- Frontend inventing payments from ClickPesa’s merchant UI
- Manual Record payment replacing the webhook path
- Treating `DEPOSIT RECEIVED` as a loan repayment (that must stay treasury/cashbook unless explicitly productized)

## Definition of done

Demo: customer pays ClickPesa BillPay with their Falco payment reference → without any staff clicking **Record payment**, the Payments table shows a new row for that customer/loan/amount, and loan outstanding/`% paid` updates after refresh.

---

Thanks.
