# Loans Controller

## Purpose

Loans endpoints expose approved loan accounts, repayment schedules, and restructuring actions after final application approval.

## Endpoints

All endpoints require bearer auth.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/loans` | `loans.view`, `loans.approve`, or `loans.disburse` | Paginated loan list |
| GET | `/loans/{loan}` | `loans.view`, `loans.approve`, or `loans.disburse` | Loan detail |
| GET | `/loans/{loan}/schedule` | `loans.view`, `loans.approve`, or `loans.disburse` | Repayment schedule rows |
| POST | `/loans/{loan}/restructure` | `loans.approve` | Restructure an active loan |

## Branch Scope

Super admins may access all branches. Branch-scoped users can only list, view, schedule, or restructure loans in their assigned branch. Sending another `branch_id` filter or targeting another branch loan returns `403 FORBIDDEN`.

## Inputs

`GET /loans` query params: `customer_id`, `status`, `branch_id`, `in_arrears`, `page`, `page_size`.

`POST /loans/{loan}/restructure` accepts the restructure payload defined by the backend request validator and recalculates immutable schedule rows through the loan restructure service.

## Outputs

Loan endpoints return `LoanResource` payloads with customer/product context where applicable. Schedule endpoints return ordered repayment schedule rows.

## Error Handling

- `401 UNAUTHORIZED`: missing or invalid bearer token.
- `403 FORBIDDEN`: missing loan permission or cross-branch access attempt.
- `404 NOT_FOUND`: loan route model not found.
- `422 VALIDATION_ERROR`: invalid restructure payload or invalid loan state.

## Edge Cases

- `in_arrears=true` filters to loans with `days_in_arrears > 0`; `false` filters to current loans.
- Schedule rows are ordered by `installment_number`.
- Restructure mutations are audited by the restructure service.

## Acceptance Criteria

- Loan list and detail responses enforce branch isolation.
- Schedules are only exposed for loans inside the authenticated user's branch scope.
- Restructure requests cannot mutate another branch's loan.
