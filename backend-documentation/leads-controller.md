# Leads Controller

## Purpose

Manages field-captured prospects before they become customers. Leads cannot have loan applications until converted into customer records.

## Endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/leads` | `leads.view` or related write permissions | Paginated lead list. |
| POST | `/leads` | `leads.create` or `customers.create` | Create a field lead. |
| GET | `/leads/{id}` | `leads.view` or related write permissions | Read lead detail. |
| PATCH | `/leads/{id}` | `leads.update` | Update mutable lead fields. |
| POST | `/leads/{id}/convert` | `leads.convert` or `customers.create` | Convert lead into customer. |

All endpoints require `Authorization: Bearer <access_token>`.

## Inputs

### List Leads

| Query Param | Type | Notes |
| --- | --- | --- |
| `q` | string? | Searches name, phone, location, notes. |
| `status` | string? | `new`, `follow_up`, `contacted`, `converted`. |
| `branch_id` | string? | Branch filter. Super admins may request any branch; branch-scoped users may only request their assigned branch. |
| `created_by` | string? | Officer filter. |
| `follow_up_from` | date? | Follow-up date lower bound. |
| `follow_up_to` | date? | Follow-up date upper bound. |
| `page` | number? | Defaults to 1. |
| `page_size` | number? | Defaults to 20, max 100. |

### Create Lead

```json
{
  "full_name": "Asha Juma",
  "phone_number": "255712345678",
  "alternate_phone": "255698765432",
  "location_name": "Kijitonyama",
  "latitude": "-6.792400",
  "longitude": "39.208300",
  "notes": "Interested in business loan",
  "follow_up_date": "2026-05-10",
  "status": "new",
  "branch_id": "branch-001"
}
```

`branch_id`, `created_by`, and default status are server-managed when omitted. Branch-scoped users receive `403 FORBIDDEN` if they send another branch.

### Convert Lead

```json
{
  "customer": {
    "customer_type": "individual",
    "first_name": "Asha",
    "last_name": "Juma",
    "date_of_birth": "1990-01-01",
    "gender": "female",
    "national_id": "NIDA-001",
    "physical_address": "Kijitonyama",
    "region": "Dar es Salaam",
    "district": "Kinondoni",
    "ward": "Kijitonyama",
    "employment_type": "self_employed",
    "monthly_income": 750000,
    "next_of_kin_name": "Juma Ally",
    "next_of_kin_relationship": "spouse",
    "next_of_kin_phone": "255755555555",
    "next_of_kin_address": "Kinondoni"
  }
}
```

Phone, alternate phone, and branch are inherited from the lead.

## Outputs

### Lead

```json
{
  "lead": {
    "id": "1",
    "full_name": "Asha Juma",
    "phone_number": "255712345678",
    "location_name": "Kijitonyama",
    "status": "new",
    "branch_id": "branch-001",
    "created_by": "1",
    "converted_customer_id": null,
    "converted_at": null
  }
}
```

### List

```json
{
  "data": [{ "id": "1", "full_name": "Asha Juma" }],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

### Convert

```json
{
  "lead": { "status": "converted", "converted_customer_id": "1" },
  "customer": { "id": "1", "customer_number": "CUS-260429-000123" }
}
```

## Error Handling

| Status | Code | Case |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token. |
| 403 | `FORBIDDEN` | Missing lead/customer permission or cross-branch access attempt. |
| 404 | `NOT_FOUND` | Lead not found. |
| 409 | `CONFLICT` | Lead already converted. |
| 422 | `VALIDATION_ERROR` | Invalid coordinates, status, or duplicate active customer national ID. |

## Edge Cases

- Latitude and longitude are optional but validated as decimal coordinates.
- Converted leads can only update notes.
- Conversion is transactional: customer creation and lead status update succeed or fail together.
- Repeated conversion returns `409` with the existing `converted_customer_id`.
- Conversion writes audit logs for the lead and created customer.
- Branch-scoped users can only list, read, create, update, or convert leads in their assigned branch.

## Acceptance Criteria

- Lead creation requires `full_name`, `phone_number`, and `location_name`.
- List supports search, status, branch, creator, follow-up date filters, pagination, and branch isolation.
- Lead conversion creates a customer with server-generated customer number.
- Duplicate active customer national IDs are rejected.
- Lead create/update/convert actions write audit logs.
