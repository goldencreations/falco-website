# Reports Controller

## Purpose

Reports endpoints expose portfolio, aging, disbursement, and collection report rows for management views and exports.

## Endpoints

### `GET /reports/portfolio-summary`

Query: `branch_id?`, `as_of?`

Branch-scoped users may omit `branch_id` or send their own branch only. Sending another branch returns `403 FORBIDDEN`. Super admins may request any branch or omit it for global output.

Output:

```json
{
  "as_of": "2026-06-30",
  "metrics": {},
  "by_product": [],
  "by_branch": []
}
```

### `GET /reports/aging`

Query: `branch_id?`, `as_of?`

Output:

```json
{
  "rows": [
    {
      "classification": "substandard",
      "days_from": 31,
      "days_to": 90,
      "loan_count": 4,
      "outstanding_amount": 2000000,
      "provision_amount": 500000,
      "percentage": 20
    }
  ],
  "totals": {
    "outstanding_amount": 2000000,
    "provision_amount": 500000
  }
}
```

Aging buckets: `current` 0 days, `watch` 1-30, `substandard` 31-60, `doubtful` 61-90, `loss` 91+.

### `GET /reports/disbursements`

Query: `from`, `to`, `branch_id?`, `page`, `page_size`

Output:

```json
{
  "rows": [
    {
      "loan_id": "1",
      "loan_number": "LN-000001",
      "customer_name": "Asha Musa",
      "amount": 750000,
      "disbursement_date": "2026-06-10",
      "branch_name": "branch-001",
      "product_name": "Group Loan"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

### `GET /reports/collections`

Query: `from`, `to`, `branch_id?`, `granularity=daily|monthly`

Output:

```json
{
  "rows": [
    {
      "period_start": "2026-06-01",
      "period_end": "2026-06-30",
      "expected_amount": 125000,
      "collected_amount": 50000,
      "collection_rate": 40,
      "branch_id": "branch-001"
    }
  ]
}
```

### `GET /reports/{type}/export`

Types: `portfolio-summary`, `aging`, `disbursements`, `collections`.

Query: same filters as report plus required `format=csv|xlsx|pdf`.

CSV exports return an attachment response. `xlsx` and `pdf` currently return `422 VALIDATION_ERROR` until a real binary exporter is approved.

## Error Handling

- `401`: missing or invalid bearer token.
- `403`: missing `reports.view`, missing `reports.export`, role report matrix denies the report, or branch filter is outside the user's assigned branch.
- `404`: unsupported export/report type.
- `422`: missing date range, invalid date range, invalid granularity, or invalid export format.

## Edge Cases

- Branch users are always scoped to their token branch; sending another `branch_id` is rejected with `403 FORBIDDEN`.
- Empty reports return empty rows or zero totals.
- Collection rows combine expected schedule amounts and verified payment collections by period.

## Acceptance Criteria

- Aging buckets match loan days-in-arrears policy.
- Exports are permission-gated by `reports.export`.
- Report access matrix controls which roles can view each report.
- Date-range reports require both `from` and `to`.
- Branch isolation is enforced before report queries and export generation.
- Monthly collection grouping is done outside SQLite-specific SQL so production database drivers remain compatible.
