# Branches Controller

## Purpose

Manages branch records, branch assignments, operational summaries, and branch export payloads.

## Endpoints

All endpoints require bearer auth.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/branches` | List branches visible to the actor |
| POST | `/branches` | Create a branch |
| PATCH | `/branches/{branch}` | Update branch metadata |
| GET | `/branches/summary` | Return branch operational aggregates |
| PATCH | `/branches/{branch}/manager` | Assign branch manager |
| POST | `/branches/{branch}/officers` | Assign staff to branch |
| DELETE | `/branches/{branch}/officers/{user}` | Remove staff branch assignment |
| GET | `/branches/{branch}/export` | JSON export payload for PDF/report helpers |

## Inputs

Branch create/update accepts `id`, `name`, `code`, `region`, `address`, `phone`, `manager_id`, and `is_active`. `code` is unique. If `id` is omitted, it is derived from `code`.

## Outputs

Branch responses return `{ "branch": Branch }` or `{ "branches": Branch[] }`. Summary rows include manager, officers, customer count, loan count, disbursed, collected, overdue, next due, and last contact values.

## Error Handling

- `401 UNAUTHORIZED`: missing/invalid token.
- `403 FORBIDDEN`: missing permission or branch-scope violation.
- `422 VALIDATION_ERROR`: duplicate code, invalid manager, invalid fields.

## Edge Cases

- Branch managers can only read their own branch summary.
- Manager assignment also updates the manager user's `branch_id`.
- Existing resource `branch_id` fields remain strings; no foreign-key migration is required for old data.

## Acceptance Criteria

- Branch codes are unique.
- Manager/officer assignments are audited.
- Super admins can manage all branches; branch users cannot escape their branch.
