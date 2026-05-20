# Loan Products Controller

## Purpose

Manages the loan product catalog used by applications, calculator previews, eligibility checks, and future disbursement schedule generation.

## Endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/products` | `products.view` or `products.manage` | List loan products. Defaults to active products. |
| POST | `/products` | `products.manage` | Create a loan product. |
| GET | `/products/{id}` | `products.view` or `products.manage` | Read product detail. |
| PATCH | `/products/{id}` | `products.manage` | Update product fields. |
| POST | `/products/{id}/activate` | `products.manage` | Mark product active. |
| POST | `/products/{id}/deactivate` | `products.manage` | Retire product from new usage. |

All endpoints require `Authorization: Bearer <access_token>`.

## Inputs

### List Products

| Query Param | Type | Notes |
| --- | --- | --- |
| `is_active` | boolean? | Defaults to `true`. Use `false` to list retired products. |

### Create Product

```json
{
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
  "required_documents": ["national_id", "business_license"],
  "allowed_risk_grades": ["A", "B"],
  "is_active": true
}
```

### Update Product

All create fields are patchable. Code is normalized to uppercase.

## Outputs

### List

```json
{
  "data": [
    {
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
      "is_active": true,
      "created_at": "2026-04-29T17:00:00.000000Z",
      "updated_at": "2026-04-29T17:00:00.000000Z"
    }
  ]
}
```

### Create, Detail, Update, Activate, Deactivate

```json
{
  "product": {
    "id": "1",
    "name": "Micro Business 30",
    "code": "MICRO-30"
  }
}
```

## Data Shapes

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Serialized string ID. |
| `name` | string | Display name. |
| `code` | string | Unique, uppercase, alpha-dash. |
| `min_amount` / `max_amount` | number | Product amount bounds. |
| `min_term_days` / `max_term_days` | number | Product term bounds. |
| `interest_type` | string | `flat` or `reducing_balance`. |
| `interest_rate_per_month` | number | Percent, 0 to 100. |
| `processing_fee_percent` | number | Percent, 0 to 100. |
| `insurance_fee_percent` | number | Percent, 0 to 100. |
| `repayment_frequency` | string | `daily`, `weekly`, `bi_weekly`, or `monthly`. |
| `grace_period_days` | number | Non-negative integer. |
| `required_documents` | string[] | Product-required application documents. |
| `allowed_risk_grades` | string[] | Allowed customer grades: `A`, `B`, `C`, `D`. |
| `is_active` | boolean | Retired products cannot start new applications. |

## Error Handling

All errors use the shared envelope.

Common cases:

| Status | Code | Case |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token. |
| 403 | `FORBIDDEN` | User lacks product permission. |
| 404 | `NOT_FOUND` | Product does not exist. |
| 422 | `VALIDATION_ERROR` | Duplicate code, invalid enum, invalid bounds, invalid fee/rate. |

## Edge Cases

- `code` is normalized to uppercase before validation/storage.
- `max_amount` must be greater than or equal to `min_amount`.
- `max_term_days` must be greater than or equal to `min_term_days`.
- Activate/deactivate are explicit endpoints so products are retired without deleting history.
- Rate changes affect future application/calculator flows; historical loan terms should keep their saved product snapshot when that module is implemented.

## Acceptance Criteria

- Product code is unique.
- Active list defaults to `is_active=true`.
- Product creation/update/activation/deactivation writes audit logs.
- Unauthorized users cannot manage products.
- Product fields validate against sensible bounds and canonical enums.
