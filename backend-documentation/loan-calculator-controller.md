# Loan Calculator Controller

## Purpose

Provides stateless loan pricing and installment previews for product-backed application forms and manual officer simulations. This service should also be reused later by application review and loan schedule materialization to keep math consistent.

## Endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| POST | `/calculator/preview` | `products.view`, `applications.create`, or `loans.view` | Calculate repayment preview. |
| GET | `/calculator/products/{product}/defaults` | Same | Return product bounds/defaults for forms. |

All endpoints require `Authorization: Bearer <access_token>`.

## Inputs

### Product-Backed Preview

```json
{
  "product_id": 1,
  "principal": 1000000,
  "term_days": 90,
  "start_date": "2026-05-01"
}
```

When `product_id` is present, product rate, fee, frequency, and bounds are loaded from the backend. Client-supplied rate/fee overrides are ignored.

### Manual Preview

```json
{
  "principal": 1000000,
  "loan_period_months": 3,
  "repayment_frequency": "monthly",
  "interest_type": "flat_interest",
  "interest_rate_per_month": 6,
  "processing_fee_percent": 2,
  "insurance_fee_percent": 1,
  "start_date": "2026-05-01"
}
```

Manual mode requires `interest_type`, `interest_rate_per_month`, `repayment_frequency`, and either `term_days` or `loan_period_months`.

## Outputs

```json
{
  "result": {
    "principal": 1000000,
    "term_days": 90,
    "loan_period_months": 3,
    "interest_rate": 6,
    "interest_type": "flat",
    "interest_amount": 180000,
    "processing_fee": 20000,
    "insurance_fee": 10000,
    "total_fees": 30000,
    "total_repayment": 1210000,
    "installment_amount": 403333.33,
    "repayment_count": 3,
    "repayment_frequency": "monthly",
    "first_repayment_date": "2026-06-01",
    "schedule_preview": [
      {
        "installment_number": 1,
        "due_date": "2026-06-01",
        "principal_due": 333333.33,
        "interest_due": 60000,
        "fees_due": 10000,
        "total_due": 403333.33
      }
    ]
  }
}
```

### Defaults

```json
{
  "product": {
    "id": "1",
    "name": "Micro Business 30",
    "code": "MICRO-30",
    "min_amount": 100000,
    "max_amount": 5000000,
    "min_term_days": 30,
    "max_term_days": 180,
    "interest_type": "flat",
    "interest_rate_per_month": 6,
    "processing_fee_percent": 2,
    "insurance_fee_percent": 1,
    "repayment_frequency": "monthly",
    "grace_period_days": 3,
    "required_documents": ["national_id"],
    "allowed_risk_grades": ["A", "B"],
    "is_active": true
  }
}
```

## Error Handling

| Status | Code | Case |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token. |
| 403 | `FORBIDDEN` | Missing calculator-related permission. |
| 404 | `NOT_FOUND` | Unknown product ID. |
| 422 | `VALIDATION_ERROR` | Missing manual fields, invalid enum, or principal/term outside product bounds. |

## Edge Cases

- `flat_interest` normalizes to `flat`.
- `declining_balance` normalizes to `reducing_balance`.
- Product-backed previews ignore client-supplied fee/rate overrides.
- `term_days` is derived from `loan_period_months * 30` when `term_days` is absent.
- Schedule rows are rounded to 2 decimals; the final row absorbs rounding remainder.

## Acceptance Criteria

- Product-backed previews use product settings and enforce product bounds.
- Manual previews support current frontend fields.
- Response math includes interest, fees, total repayment, installment amount, repayment count, first repayment date, and schedule preview.
- Defaults endpoint returns product min/max and pricing fields required by forms.
