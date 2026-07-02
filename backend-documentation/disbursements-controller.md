# Disbursements Controller

## Purpose

Disbursements release approved loan funds. The API follows pessimistic activation: gateway payouts create a pending disbursement and keep the loan in `pending_disbursement`; only cash disbursements complete immediately and activate the loan.

## Endpoints

All endpoints require bearer auth.

Branch scope: disbursement endpoints are scoped through the loan branch. Super admins may access all branches; branch-scoped users can only disburse or list disbursements for loans in their assigned branch. Cross-branch loan route models return `403 FORBIDDEN`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/disbursements` | loan view/disburse/approve permissions | Frontend disbursement console |
| POST | `/disbursements` | loan disburse/approve permissions | Prepare pending-approval disbursement |
| GET | `/disbursements/{disbursement}` | loan view/disburse/approve permissions | Console detail |
| PATCH | `/disbursements/{disbursement}` | loan disburse/approve permissions | Approve, reject, or complete console row |
| POST | `/loans/{loan}/disburse` | `loans.disburse` or `loans.approve` | Create a disbursement attempt |
| GET | `/loans/{loan}/disbursements` | `loans.view`, `loans.disburse`, or `loans.approve` | List disbursement attempts for a loan |

## Inputs

```json
{
  "disbursement_date": "2026-05-01",
  "disbursed_amount": 1000000,
  "disbursement_channel": "mobile_money",
  "mobile_money_phone": "255712345678",
  "bank_account_number": null,
  "bank_account_name": null,
  "bank_bic": null,
  "bank_transfer_type": null,
  "notes": "Optional notes"
}
```

Channels:

- `cash`
- `mobile_money`
- `bank_transfer`

`mobile_money_phone` is required for `mobile_money`. `bank_account_number`, `bank_account_name`, `bank_bic`, and `bank_transfer_type` are required for `bank_transfer`.

## Outputs

Cash disbursement returns `200`:

```json
{
  "loan": {
    "status": "active",
    "disbursement_date": "2026-05-01",
    "maturity_date": "2026-08-01",
    "schedule": []
  },
  "disbursement": {
    "status": "completed",
    "gateway": null,
    "order_reference": "DISB-1-1"
  }
}
```

Gateway disbursement returns `202`:

```json
{
  "loan": {
    "status": "pending_disbursement"
  },
  "disbursement": {
    "status": "pending",
    "gateway": "clickpesa",
    "order_reference": "DISB-1-1"
  }
}
```

## Behaviour

- `/disbursements` console rows expose frontend statuses: `pending_approval`, `approved`, `completed`, and `rejected`.
- `POST /disbursements` creates `pending_approval` only; it does not call the gateway and does not activate the loan.
- `PATCH /disbursements/{id}` supports `{ "action": "approve" }`, `{ "action": "reject", "rejection_reason": "..." }`, and `{ "action": "complete", "transaction_reference": "...", "disbursed_at": "..." }`.
- Approving a cash/manual row activates the loan immediately.
- Approving a mobile-money or bank row submits the payout to ClickPesa and leaves the loan pending until a success callback or confirmation job completes it.
- Completing an approved row is a manual operational fallback; the frontend does not automatically complete a ClickPesa payout.

- `order_reference` is deterministic per loan attempt: `DISB-{loan_id}-{attempt}`.
- `cash` creates a completed disbursement, activates the loan, marks the application `disbursed`, and materializes immutable repayment schedule rows.
- `mobile_money` and `bank_transfer` create a pending ClickPesa disbursement only; loan/application status remain `pending_disbursement`.
- A new attempt is blocked while a pending, processing, or completed disbursement exists. Reversed attempts may be retried.
- `disbursed_amount` must equal the loan principal for now, keeping principal, outstanding balances, and schedule math reconciled.

## Error Handling

- `422 VALIDATION_ERROR` for missing channel details, non-disbursable loan/application status, duplicate active disbursement attempt, amount mismatch, or unreconciled outstanding balances.
- `403 FORBIDDEN` when the user lacks loan disbursement permissions or attempts cross-branch access.
- `404 NOT_FOUND` when the loan does not exist.

## Edge Cases

- Successful gateway payout callbacks activate the loan and create its repayment schedule; processing payouts may also be settled by the confirmation job after the configured reversal window.
- Existing schedules are not regenerated if a cash activation is retried internally.
- Schedule rounding places the remaining cents on the final installment.
- Branch access is checked before creating or listing disbursement attempts.
- Rejected console rows map to the internal reversed state and release remaining eligibility.

## Acceptance Criteria

- Console list returns `disbursements`, `kpis`, and `eligible_loans`.
- Cash disbursement activates loan and creates repayment schedule rows.
- Gateway-routed disbursement leaves loan pending.
- Active disbursement attempts are idempotency protected.
- Disbursement mutations write audit logs.
