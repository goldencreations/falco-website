# Customers Controller

## Purpose

Manages the customer KYC registry. Customers are the borrower records used by leads, applications, loans, payments, and collections.

## Endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/customers` | `customers.view` or customer write permissions | Paginated customer list. |
| POST | `/customers` | `customers.create` | Register a new customer. |
| GET | `/customers/{id}` | `customers.view` or customer write permissions | Read full customer profile. |
| PATCH | `/customers/{id}` | `customers.update` | Update mutable KYC/profile fields. |
| POST | `/customers/{id}/activate` | `customers.update` | Reactivate a deactivated customer. |
| POST | `/customers/{id}/deactivate` | `customers.update` | Deactivate a customer. |

All endpoints require `Authorization: Bearer <access_token>`.

## Inputs

### List Customers

| Query Param | Type | Notes |
| --- | --- | --- |
| `q` | string? | Searches customer number, name, phone, national ID. |
| `branch_id` | string? | Branch filter. Super admins may request any branch; branch-scoped users may only request their assigned branch. |
| `risk_grade` | string? | `A`, `B`, `C`, `D`. |
| `is_active` | boolean? | Active/deactivated filter. |
| `page` | number? | Defaults to 1. |
| `page_size` | number? | Defaults to 20, max 100. |

### Create Customer

```json
{
  "customer_type": "individual",
  "first_name": "Asha",
  "middle_name": "M",
  "last_name": "Juma",
  "date_of_birth": "1990-01-01",
  "gender": "female",
  "national_id": "19900101123456789012",
  "phone_number": "255712345678",
  "alternate_phone": "255698765432",
  "email": "asha@example.com",
  "physical_address": "Kijitonyama",
  "region": "Dar es Salaam",
  "district": "Kinondoni",
  "ward": "Kijitonyama",
  "employment_type": "self_employed",
  "monthly_income": 750000,
  "business_name": "Asha Shop",
  "business_type": "retail",
  "next_of_kin_name": "Juma Ally",
  "next_of_kin_relationship": "spouse",
  "next_of_kin_phone": "255755555555",
  "next_of_kin_address": "Kinondoni",
  "risk_grade": "B",
  "credit_score": 650,
  "is_blacklisted": false,
  "branch_id": "branch-001",
  "metadata": {}
}
```

`customer_number`, `created_by`, and `is_active` are server-managed. If `branch_id` is omitted, the backend uses the authenticated user's branch. Branch-scoped users receive `403 FORBIDDEN` if they submit a different `branch_id`.

### Update Customer

All create fields are patchable except `customer_number` and `created_by`, which are ignored if sent.

## Outputs

### List

```json
{
  "data": [
    {
      "id": "1",
      "customer_number": "CUS-260429-000123",
      "full_name": "Asha M Juma",
      "phone_number": "255712345678",
      "national_id": "19900101123456789012",
      "region": "Dar es Salaam",
      "risk_grade": "B",
      "branch_id": "branch-001",
      "is_active": true,
      "created_at": "2026-04-29T17:00:00.000000Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

### Detail/Create/Update/Activate/Deactivate

```json
{
  "customer": {
    "id": "1",
    "customer_number": "CUS-260429-000123",
    "customer_type": "individual",
    "first_name": "Asha",
    "full_name": "Asha M Juma",
    "national_id": "19900101123456789012",
    "phone_number": "255712345678",
    "is_active": true
  }
}
```

## Data Shapes

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `customer_number` | string | Server-generated, immutable. |
| `national_id` | string | Unique among active customers. |
| `branch_id` | string | Defaults to current user branch if omitted. |
| `risk_grade` | string/null | `A`, `B`, `C`, or `D`. |
| `credit_score` | number/null | 0 to 999. |
| `is_blacklisted` | boolean | Future applications must enforce override workflow. |
| `metadata` | object | Extensible non-core fields. |

## Error Handling

All errors use the shared envelope.

| Status | Code | Case |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token. |
| 403 | `FORBIDDEN` | Missing customer permission or cross-branch access attempt. |
| 404 | `NOT_FOUND` | Customer not found. |
| 409 | `CONFLICT` | Reactivating would duplicate an active national ID. |
| 422 | `VALIDATION_ERROR` | Invalid fields or duplicate active national ID during create/update. |

## Edge Cases

- Inactive customer records can share a national ID with a new active record.
- Reactivating an inactive duplicate returns `409`.
- `customer_number` is ignored on update.
- Create/update/activate/deactivate write audit logs.
- Branch-scoped users can only list, read, create, update, activate, or deactivate customers in their assigned branch.
- Route-model access checks the customer branch before returning detail or mutating the record.

## Acceptance Criteria

- Active national IDs are unique.
- List supports search, branch, risk grade, active flag, and pagination while enforcing branch isolation.
- Create generates `customer_number`.
- Mutations write audit logs with before/after snapshots.
- Customer records can be deactivated/reactivated without deletion.
