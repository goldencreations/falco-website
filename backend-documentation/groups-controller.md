# Groups Controller

## Purpose

Supports Vikundi/group lending without overloading individual customer loans.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/groups` | Paginated group list |
| POST | `/groups` | Create group |
| GET | `/groups/{group}` | Group detail with members |
| PATCH | `/groups/{group}` | Update group metadata |
| POST | `/groups/{group}/members` | Add member |
| DELETE | `/groups/{group}/members/{customer}` | Mark member as left |
| POST | `/groups/{group}/applications` | Create group-mode application |

## Inputs

Group create requires `group_name`, `loan_officer_id`, `chairperson_customer_id`, `formation_date`, `meeting_day`, `meeting_location`, and `village_or_street`. Optional fields include `branch_id`, `group_code`, secretary/treasurer IDs, member IDs, status, and notes.

## Outputs

Responses return `LoanGroup` with `member_customer_ids`, member rows, role customer IDs, branch ID, status, and timestamps.

## Error Handling

- `403 FORBIDDEN`: missing permission or cross-branch access.
- `422 VALIDATION_ERROR`: customers/officer not active or not in the group branch, duplicate code, invalid status.

## Edge Cases

- Member removal sets `left_at` rather than deleting history.
- Group applications use the chairperson customer as borrower anchor and set `loan_mode=group_based` plus `group_id`.

## Acceptance Criteria

- All group people must belong to the same branch.
- Group application responses expose group loan aliases.
- Group mutations are audited.
