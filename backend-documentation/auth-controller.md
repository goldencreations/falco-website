# Auth Controller

## Purpose

Handles staff authentication for the Falco LMS API. Users are created by authorized admins through `POST /users`; there is no public self-registration route.

## CORS

CORS is enabled for all origins, methods, headers, and paths. Frontends can call the API from any domain using JSON requests and bearer tokens.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/login` | Public | Primary login endpoint. |
| POST | `/auth/login` | Public | Compatibility login endpoint. Same response as `/api/login`. |
| GET | `/api/me` | Bearer token | Return current user and permissions. |
| POST | `/api/logout` | Bearer token | Revoke the current access token. |

## Inputs

### Login

```json
{
  "email": "admin@falco.com",
  "password": "Admin@123",
  "rememberMe": false
}
```

`rememberMe` is optional.

### Logout

Send the current access token in the `Authorization` header. No body is required.

```http
Authorization: Bearer <access_token>
```

## Outputs

### Login `200`

```json
{
  "ok": true,
  "access_token": "string",
  "token_type": "Bearer",
  "tokens": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 3600,
    "token_type": "Bearer"
  },
  "user": {
    "id": 1,
    "email": "admin@falco.com",
    "full_name": "System Admin",
    "role": "admin",
    "branch_id": null
  }
}
```

Use either top-level `access_token` or `tokens.access_token` as the bearer token.

### Current User `200`

```json
{
  "user": {
    "id": 1,
    "email": "admin@falco.com",
    "full_name": "System Admin",
    "role": "admin",
    "branch_id": null,
    "permissions": ["dashboard.view", "users.manage"]
  }
}
```

### Logout `200`

```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

## Data Shapes

### User

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number/string | Some nested resources serialize ids as strings. Treat ids as opaque. |
| `email` | string | Staff email address. |
| `full_name` | string | Staff display name. |
| `role` | string | `admin`, `manager`, `loan_officer`, `credit_analyst`, `collections_officer`, `accountant`, or `customer_service`. |
| `branch_id` | string/null | Null for global admins; required for branch-scoped users. |
| `permissions` | string[] | Returned by `/api/me`. Use this for feature gating. |

### Tokens

| Field | Type | Notes |
| --- | --- | --- |
| `access_token` | string | Send as `Authorization: Bearer <token>`. |
| `refresh_token` | string | Returned for future compatibility; no public refresh route is currently registered. |
| `expires_in` | number | Access token lifetime in seconds. |
| `token_type` | string | Always `Bearer`. |

## Error Handling

Validation failures return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": [{ "field": "email", "message": "The email field is required." }],
    "request_id": "uuid"
  }
}
```

Authentication failures:

| Status | Case |
| --- | --- |
| 401 | Invalid credentials or invalid/missing bearer token. |
| 403 | Inactive account. |

## Edge Cases

- Passwords and token hashes are never returned.
- Admin-created users can log in with the `temporary_password` supplied to `POST /users`.
- Calling `/api/logout` revokes the current access token; subsequent calls using that token return `401`.
- Store the bearer token in frontend state or secure storage appropriate for the client platform.

## Acceptance Criteria

- Login works through both `/api/login` and `/auth/login`.
- Authenticated requests include `Authorization: Bearer <access_token>`.
- `/api/me` drives frontend user, role, and permission state.
- Frontend handles `401` by redirecting to login.
- Frontend handles `403` by hiding or disabling unauthorized actions.
