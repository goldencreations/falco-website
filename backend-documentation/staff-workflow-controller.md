# Staff Workflow Controller

## Purpose

Supports branch manager staff requests and super-admin review workflows for provisioning, suspension, and reinstatement.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/users/provisioning-requests` | List provisioning requests |
| POST | `/users/provisioning-requests` | Request new staff user |
| PATCH | `/users/provisioning-requests/{request}` | Approve or reject request |
| GET | `/users/access-requests` | List suspend/reinstate requests |
| POST | `/users/access-requests` | Request suspend/reinstate |
| PATCH | `/users/access-requests/{request}` | Approve or reject access request |

## Inputs

Provisioning create accepts `full_name`, `email`, `phone`, `role`, `branch_id`, and notes. Access create accepts `type=suspend|reinstate`, `staff_id`, and reason. Review accepts `status=approved|rejected` plus notes.

## Outputs

Responses return `request` payloads with status, reviewer, timestamps, branch IDs, and linked created user ID where applicable.

## Error Handling

- `403 FORBIDDEN`: missing user management permission or cross-branch access.
- `422 VALIDATION_ERROR`: invalid role, invalid status transition, or invalid staff target.

## Edge Cases

- Approved provisioning creates a real user with generated employee ID and password hash.
- Approved suspension revokes active auth tokens.
- Approved reinstatement reactivates the target staff user.

## Acceptance Criteria

- Branch managers can only request actions in their branch.
- Super admins can review globally.
- All workflow actions are audited.
