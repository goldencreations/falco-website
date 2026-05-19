# Dashboard Controller

## Purpose

Dashboard endpoints provide read-only aggregate snapshots for KPIs, portfolio charts, branch comparison, and recent operational activity.

## Endpoints

### `GET /dashboard/metrics`

Query: `branch_id?`

Branch-scoped users may omit `branch_id` or send their own branch only. Sending another branch returns `403 FORBIDDEN`. Super admins may filter by branch or omit it for all branches.

Output:

```json
{
  "metrics": {
    "as_of": "2026-04-30T08:00:00.000000Z",
    "branch_id": "branch-001",
    "portfolio": {
      "loan_count": 10,
      "active_loan_count": 8,
      "outstanding_amount": 12000000,
      "principal_outstanding": 10000000,
      "interest_outstanding": 1700000,
      "fees_outstanding": 300000
    },
    "risk": {
      "par_amount": 1500000,
      "par_rate": 12.5,
      "npl_amount": 500000,
      "npl_rate": 4.17
    },
    "applications": {
      "total": 14,
      "submitted": 3,
      "under_review": 4,
      "approved": 2,
      "rejected": 1
    },
    "disbursements": {
      "count": 6,
      "amount": 8000000
    },
    "collections": {
      "amount": 3000000,
      "count": 20,
      "collection_rate": 20
    }
  }
}
```

### `GET /dashboard/portfolio-by-product`

Query: `branch_id?`

Output:

```json
{
  "items": [
    {
      "product_id": "1",
      "product_name": "Group Loan",
      "loan_count": 5,
      "outstanding_amount": 4200000,
      "par_amount": 900000
    }
  ]
}
```

### `GET /dashboard/portfolio-by-branch`

Super admin only.

Output:

```json
{
  "items": [
    {
      "branch_id": "branch-001",
      "branch_name": "branch-001",
      "loan_count": 12,
      "outstanding_amount": 9000000,
      "collection_rate": 25
    }
  ]
}
```

### `GET /dashboard/recent-activity`

Query: `limit?` defaults to `20`, max `50`.

Output:

```json
{
  "items": [
    {
      "id": "payment-1",
      "type": "payment_received",
      "title": "Payment received",
      "description": "100000 received",
      "entity_id": "1",
      "created_at": "2026-04-30T08:00:00.000000Z",
      "performed_by_name": null
    }
  ]
}
```

### `GET /dashboard/timeseries`

Query: `metric=disbursements|collections|outstanding|par`, `from`, `to`, `branch_id?`.

### `GET /dashboard/aging-breakdown`

Returns BOT-style aging buckets: `current`, `especially_mentioned`, `substandard`, `doubtful`, `loss`.

### `GET /dashboard/loans-requiring-attention`

Returns overdue loans with customer, product, outstanding amount, days overdue, and risk classification fields.

## Error Handling

- `401`: missing or invalid bearer token.
- `403`: missing `dashboard.view` permission, non-super-admin access to branch comparison, or cross-branch filter attempt.

## Edge Cases

- Empty ledgers return zero counts and zero rates.
- NPL includes defaulted loans and loans at least 90 days in arrears.
- PAR includes in-arrears and defaulted loans.
- Collection rate is calculated as collected payments over collected plus current outstanding.

## Acceptance Criteria

- Snapshot includes an `as_of` timestamp.
- Branch users cannot escape their token branch; explicit cross-branch filters are rejected.
- Super admins can compare branches.
- Recent activity is capped at 50 items and avoids customer PII.
- Metrics include both nested backend aggregates and frontend flat keys.
