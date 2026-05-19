# Payments Controller

## Purpose

Payments record loan repayments and allocate them atomically to loan outstanding balances and repayment schedule rows.

## Endpoints

All endpoints require bearer auth.

Branch scope: payment visibility and mutations are scoped through the payment loan. Super admins may access all branches; branch-scoped users can only list, record, view, or reverse payments for loans in their assigned branch. Cross-branch loan IDs or payment records return `403 FORBIDDEN`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/payments` | `payments.view`, `payments.create`, or `payments.reverse` | Paginated payment list |
| POST | `/payments` | `payments.create` | Record a repayment |
| GET | `/payments/{payment}` | `payments.view`, `payments.create`, or `payments.reverse` | Payment detail |
| POST | `/payments/{payment}/reverse` | `payments.reverse` | Reverse a verified payment |
| GET | `/payments/reconciliation-summary` | payment permissions | Reconciliation widget counts |

## Inputs

Create payment:

```json
{
  "loan_id": "1",
  "amount": 250000,
  "payment_method": "cash",
  "reference_number": "CASH-001",
  "payment_date": "2026-06-01",
  "mobile_money_provider": null,
  "mobile_money_number": null,
  "notes": "First repayment"
}
```

Reverse payment:

```json
{
  "reason": "Wrong customer receipt"
}
```

## Outputs

```json
{
  "payment": {
    "id": "1",
    "payment_number": "PAY-20260429-000001",
    "loan_id": "1",
    "customer_id": "1",
    "amount": 250000,
    "fees_amount": 30000,
    "interest_amount": 180000,
    "principal_amount": 40000,
    "principal_allocated": 40000,
    "interest_allocated": 180000,
    "fees_allocated": 30000,
    "penalty_allocated": 0,
    "status": "completed",
    "ledger_status": "verified",
    "payment_method": "cash",
    "reference_number": "CASH-001",
    "payment_date": "2026-06-01"
  }
}
```

## Allocation Policy

Payments allocate in this order:

1. Fees
2. Interest
3. Principal

The same order is applied to both loan outstanding totals and repayment schedule rows.

## Error Handling

- `422 VALIDATION_ERROR` for overpayments, duplicate references, inactive loan states, missing schedules, or missing mobile-money details.
- `403 FORBIDDEN` when the user lacks payment permissions or attempts cross-branch access.
- `404 NOT_FOUND` when a payment or loan does not exist.

## Edge Cases

- Payment amount cannot exceed `loan.total_outstanding`.
- Loans must be `active` or `in_arrears`.
- Duplicate `reference_number` is rejected for idempotency.
- Reversal marks the original payment reversed and creates a negative compensating payment row.
- Reversals restore loan outstanding balances and schedule paid/balance fields.
- Webhook/system processing may record gateway payments without a user branch actor after gateway validation.
- Frontend responses map internal `verified` ledger rows to `status: "completed"` while preserving `ledger_status`.
- Payments with no reconciliation metadata count as unmatched in `/payments/reconciliation-summary`.

## Acceptance Criteria

- Payment creation, schedule allocation, and loan balance updates are atomic.
- Allocation columns are returned in API responses.
- Reversals are audit logged and idempotent.
