# Reconciliation Controller

## Purpose

Provides a lightweight payment reconciliation summary for the payments UI.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/payments/reconciliation-summary` | Count matched, underpaid, overpaid, manual review, and unmatched payments |

## Inputs

No body. The summary is branch-scoped through each payment's loan.

## Outputs

```json
{
  "summary": {
    "matched": 0,
    "underpaid": 0,
    "overpaid": 0,
    "manual_review": 0,
    "unmatched": 0
  }
}
```

## Error Handling

- `401 UNAUTHORIZED`: missing/invalid token.
- `403 FORBIDDEN`: missing payment permission.

## Edge Cases

- Payments with no reconciliation metadata count as `unmatched`.
- This endpoint is summary-only; detailed statement imports can be added later without changing the summary shape.

## Acceptance Criteria

- Branch-scoped users only see counts for their branch loans.
- Response shape matches the frontend reconciliation widget.
