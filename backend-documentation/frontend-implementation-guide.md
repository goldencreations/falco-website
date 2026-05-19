# Frontend Implementation Guide

## Purpose

This is the handoff guide for building the frontend against the Falco LMS API. It summarizes the tested browser-style workflow, auth rules, CORS behavior, data flow, and endpoint order frontend engineers can implement from.

## Base Setup

| Item | Value |
| --- | --- |
| Local API base URL | `http://localhost:8000` |
| Request format | JSON |
| Response format | JSON, except CSV export endpoints |
| Auth header | `Authorization: Bearer <access_token>` |
| CORS | Open for all origins, methods, headers, and paths |

Recommended default headers:

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer <access_token>
```

Do not send the `Authorization` header for public login or webhook calls.

## Authentication Flow

1. Login with `POST /api/login`.
2. Store `access_token`.
3. Call `GET /api/me`.
4. Use `user.permissions` to show or hide actions.
5. Send `POST /api/logout` on sign out.

Compatibility note: `POST /auth/login` is also available and returns the same payload.

There is no public self-registration. Staff users are created by admins through `POST /users`, then the created user logs in with the provided `temporary_password`.

## Error Envelope

Most API errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": [
      { "field": "email", "message": "The email field is required." }
    ],
    "request_id": "uuid"
  }
}
```

Frontend handling:

| Status | Meaning | UI behavior |
| --- | --- | --- |
| 401 | Not logged in or token revoked | Redirect to login. |
| 403 | Logged in but not allowed | Show access denied or hide action. |
| 404 | Missing record or invalid route id | Show not found state. |
| 409 | Business conflict | Show conflict message and refresh data. |
| 422 | Validation failed | Bind `details` to form fields. |

## Tested Frontend Journey

The backend now has an end-to-end feature test that drives these routes like a frontend:

1. `GET /`
2. CORS preflight `OPTIONS /api/login`
3. `POST /api/login`
4. `POST /auth/login`
5. `GET /api/me`
6. `POST /users`
7. `GET /users`
8. `PATCH /users/{user}`
9. `POST /branches`
10. `PATCH /branches/{branch}`
11. `POST /branches/{branch}/officers`
12. `DELETE /branches/{branch}/officers/{user}`
13. `POST /products`
14. `PATCH /products/{product}`
15. `POST /products/{product}/deactivate`
16. `POST /products/{product}/activate`
17. `POST /customers`
18. `GET /customers/{customer}`
19. `PATCH /customers/{customer}`
20. `POST /customers/{customer}/deactivate`
21. `POST /customers/{customer}/activate`
22. `POST /leads`
23. `PATCH /leads/{lead}`
24. `POST /leads/{lead}/convert`
25. `POST /groups`
26. `PATCH /groups/{group}`
27. `POST /groups/{group}/members`
28. `DELETE /groups/{group}/members/{customer}`
29. `POST /calculator/preview`
30. `GET /calculator/products/{product}/defaults`
31. `POST /applications`
32. `PATCH /applications/{application}`
33. `POST /applications/{application}/documents`
34. `POST /applications/{application}/submit`
35. `PATCH /applications/{application}/assign`
36. `POST /credit-analysis/applications/{application}/assign`
37. `POST /credit-analysis/applications/{application}/attachments`
38. `POST /credit-analysis/applications/{application}/analysis`
39. `GET /credit-analysis/applications/{application}`
40. `POST /applications/{application}/review`
41. `POST /disbursements`
42. `PATCH /disbursements/{disbursement}`
43. `GET /disbursements`
44. `GET /loans/{loan}`
45. `GET /loans/{loan}/schedule`
46. `POST /payments`
47. `GET /payments/{payment}`
48. `POST /payments/{payment}/reverse`
49. `GET /payments/reconciliation-summary`
50. `POST /collections/activities`
51. `GET /collections/queue`
52. `GET /dashboard/*`
53. `GET /reports/*`
54. `GET /reports/disbursements/export`
55. `PATCH /settings/organization`
56. `GET /settings/branches`
57. `GET /settings/integrations`
58. `GET /settings/payment-channels`
59. `GET /settings/profile`
60. `PATCH /settings/profile/preferences`
61. `POST /backups`
62. `GET /backups`
63. `GET /backups/schedule`
64. `PATCH /backups/schedule`
65. `GET /backups/flow`
66. `GET /backups/{backup}/download`
67. `GET /backups/export`
68. `POST /backups/restore`
69. `POST /webhooks/payment?gateway=clickpesa`
70. `POST /api/logout`

## Roles And Permissions

Use `/api/me` as the frontend source of truth for permissions. Roles currently supported:

| Role | Typical scope |
| --- | --- |
| `admin` | Global access, users, settings, approvals, backups. |
| `manager` | Branch operations, reviews, collections, reports. |
| `loan_officer` | Customers, leads, applications, groups, payment viewing/creation where permitted. |
| `credit_analyst` | Credit queue, analysis, attachments. |
| `collections_officer` | Collections queue and activities. |
| `accountant` | Payments, reversals, reports. |
| `customer_service` | Read-heavy customer support flows. |

Always expect a route to return `403` even if the menu is hidden; permissions are enforced server-side.

## Core Data Flow

### Staff Administration

Admin creates staff:

```json
POST /users
{
  "email": "officer@example.com",
  "full_name": "Loan Officer",
  "role": "loan_officer",
  "branch_id": "branch-main",
  "phone": "+255700000001",
  "employee_id": "EMP-001",
  "temporary_password": "temporary-secret"
}
```

The created staff user logs in with that temporary password.

### Customer And Lead Flow

1. Create customer with `POST /customers`.
2. Update customer with `PATCH /customers/{customer}`.
3. Toggle active state with `/activate` and `/deactivate`.
4. Create lead with `POST /leads`.
5. Update lead status with `PATCH /leads/{lead}`.
6. Convert lead to customer with `POST /leads/{lead}/convert`.

### Product And Calculator Flow

1. Admin creates product with `POST /products`.
2. Frontend fetches product defaults through `GET /calculator/products/{product}/defaults`.
3. Frontend previews repayment with:

```json
POST /calculator/preview
{
  "product_id": 1,
  "principal": 1000000,
  "term_days": 90
}
```

The response is under `result`.

### Loan Application Flow

1. Create draft with `POST /applications`.
2. Update draft with `PATCH /applications/{application}`.
3. Upload/register documents with `POST /applications/{application}/documents`.
4. Submit with `POST /applications/{application}/submit`.
5. Assign officer/workflow stage with `PATCH /applications/{application}/assign`.
6. Assign credit analyst with `POST /credit-analysis/applications/{application}/assign`.
7. Add analysis attachment with `POST /credit-analysis/applications/{application}/attachments`.
8. Store analysis with `POST /credit-analysis/applications/{application}/analysis`.
9. Manager approves with `POST /applications/{application}/review`.
10. Admin final approval creates the loan.

### Disbursement And Loan Flow

1. Create disbursement with `POST /disbursements`.
2. Approve with `PATCH /disbursements/{disbursement}` and `{ "action": "approve" }`.
3. Complete with `PATCH /disbursements/{disbursement}` and `{ "action": "complete" }`.
4. Active loan details are available at `GET /loans/{loan}`.
5. Repayment schedule is available at `GET /loans/{loan}/schedule`.

Frontend-facing disbursement statuses include `pending_approval`, `approved`, `completed`, and `rejected`.

### Payment And Collections Flow

1. Record payment with `POST /payments`.
2. View payment with `GET /payments/{payment}`.
3. Reverse payment with `POST /payments/{payment}/reverse`.
4. View reconciliation summary with `GET /payments/reconciliation-summary`.
5. Log collection activity with `POST /collections/activities`.
6. View queue with `GET /collections/queue`.

### Reporting, Dashboard, Settings, Backups

Dashboard routes:

```text
GET /dashboard/metrics
GET /dashboard/portfolio-by-product
GET /dashboard/portfolio-by-branch
GET /dashboard/recent-activity
GET /dashboard/timeseries
GET /dashboard/aging-breakdown
GET /dashboard/loans-requiring-attention
```

Reports:

```text
GET /reports/portfolio-summary?as_of=2026-06-30
GET /reports/aging
GET /reports/disbursements?from=2026-06-01&to=2026-06-30
GET /reports/collections?from=2026-06-01&to=2026-06-30&granularity=monthly
GET /reports/disbursements/export?format=csv&from=2026-06-01&to=2026-06-30
```

Settings:

```text
GET /settings/profile
PATCH /settings/profile/preferences
PATCH /settings/profile/password
GET /settings/organization
PATCH /settings/organization
GET /settings/branches
GET /settings/integrations
GET /settings/payment-channels
```

Backups are admin-only:

```text
GET /backups
POST /backups
GET /backups/schedule
PATCH /backups/schedule
POST /backups/restore
GET /backups/export?format=csv
GET /backups/flow
GET /backups/{backup}/download
```

## Acceptance Criteria For Frontend

- Login stores and uses bearer token correctly.
- All protected calls include `Authorization`.
- UI gates features using `/api/me` permissions.
- Forms show field-level `422` validation messages.
- Unauthorized actions handle `403` without crashing.
- CRUD pages refresh their local lists after create/update/toggle/delete actions.
- Branch-scoped users never offer cross-branch filters unless permitted.
- CSV export routes are downloaded as files, not parsed as JSON.
- Webhook routes are backend integration endpoints and should not be exposed as normal UI actions.
