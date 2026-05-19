# Users Controllers

## Purpose

Provides staff user administration for Falco LMS. These endpoints let authorized admins list, create, view, update, deactivate, request password resets, and manage the report-access matrix.

## Endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | `users.view` or `users.manage` | Paginated staff list. |
| POST | `/users` | `users.manage` | Create a staff user. |
| GET | `/users/{id}` | `users.view` or `users.manage` | Read staff user detail. |
| PATCH | `/users/{id}` | `users.manage` | Update staff profile, role, branch, or active status. |
| POST | `/users/{id}/reset-password` | `users.manage` | Request password reset delivery. |
| GET | `/users/report-access` | `users.manage` | Read report-access matrix. |
| PATCH | `/users/report-access` | `users.manage` | Update report-access matrix. |

All endpoints require `Authorization: Bearer <access_token>`.

Branch scope: super admins can manage users across branches. Branch-scoped users with user permissions can only list, create, view, update, or reset passwords for users in their own assigned branch. Sending another `branch_id` or targeting another branch user returns `403 FORBIDDEN`.

## Inputs

### List Users

Query params:

| Param | Type | Notes |
| --- | --- | --- |
| `branch_id` | string? | Exact branch filter. Super admins may request any branch; branch-scoped users may only request their assigned branch. |
| `role` | string? | Staff role filter. |
| `is_active` | boolean? | Active/deactivated filter. |
| `page` | number? | Defaults to 1. |
| `page_size` | number? | Defaults to 20, max 100. |

### Create User

```json
{
  "email": "officer@example.com",
  "full_name": "New Officer",
  "role": "loan_officer",
  "branch_id": "branch-001",
  "phone": "+255700000001",
  "employee_id": "EMP-001",
  "temporary_password": "optional-secret"
}
```

### Update User

All fields are optional:

```json
{
  "email": "officer@example.com",
  "full_name": "Updated Officer",
  "role": "collections_officer",
  "branch_id": "branch-002",
  "phone": "+255700000002",
  "employee_id": "EMP-002",
  "is_active": false
}
```

### Update Report Access

```json
{
  "access": {
    "loan_officer": ["portfolio_summary", "collection_report"],
    "branch_manager": ["portfolio_summary", "aging_analysis"]
  }
}
```

`super_admin` always keeps all reports even if a request tries to remove them.

## Outputs

### User

```json
{
  "user": {
    "id": "1",
    "email": "officer@example.com",
    "full_name": "New Officer",
    "role": "loan_officer",
    "branch_id": "branch-001",
    "phone": "+255700000001",
    "employee_id": "EMP-001",
    "is_active": true,
    "permissions": ["customers.view"],
    "created_at": "2026-04-29T17:00:00.000000Z",
    "last_login": null
  }
}
```

List endpoints return:

```json
{
  "data": [{ "id": "1" }],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

### Report Access

```json
{
  "available_reports": ["portfolio_summary", "aging_analysis"],
  "access": {
    "super_admin": ["portfolio_summary", "aging_analysis"],
    "loan_officer": ["collection_report"]
  }
}
```

Password reset returns `202 Accepted` with no body.

## Data Shapes

### `User`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Serialized string ID. |
| `email` | string | Unique. |
| `full_name` | string | Stored in `users.name`. |
| `role` | string | One of the configured staff roles. |
| `branch_id` | string/null | Required except for super admin. |
| `phone` | string/null | Staff contact phone. |
| `employee_id` | string/null | Unique employee identifier. |
| `is_active` | boolean | Inactive users cannot authenticate. |
| `permissions` | string[] | Resolved role + user permissions. |

## Error Handling

All errors use the shared envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": [{ "field": "email", "message": "The email has already been taken." }],
    "request_id": "uuid"
  }
}
```

Common statuses:

| Status | Code | Case |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token. |
| 403 | `FORBIDDEN` | Authenticated user lacks required permission or attempts cross-branch access. |
| 404 | `NOT_FOUND` | User route model not found. |
| 422 | `VALIDATION_ERROR` | Invalid role, report key, duplicate email, duplicate employee ID. |

## Edge Cases

- Password and remember-token fields are never returned.
- Creating a user with no `temporary_password` generates a server-side password and still does not return it.
- Deactivating a user revokes active auth tokens. Access tokens also fail because inactive users are rejected by middleware.
- Unknown roles or report keys in report access updates return validation errors.
- `super_admin` report access is restored to all reports during every update.
- Branch-scoped user administration cannot create, move, view, update, or reset users outside the actor's branch.

## Acceptance Criteria

- Authorized admins can create, list, show, and update users.
- Unauthorized staff receive `403`.
- `email` and `employee_id` are unique.
- Password reset endpoint returns `202` and never returns credentials.
- Report access changes are persisted and audited.
- User create/update/reset-password actions write audit logs.
