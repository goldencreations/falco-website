# Settings Controller

## Purpose

Exposes organization settings, staff profile preferences, masked integrations, and settings-page branch data.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/settings/organization` | Read organization settings |
| PATCH | `/settings/organization` | Update organization settings |
| GET | `/settings/profile` | Current user profile and preferences |
| PATCH | `/settings/profile/preferences` | Update profile preferences |
| PATCH | `/settings/profile/password` | Change own password |
| GET | `/settings/branches` | Branch list for settings UI |
| POST | `/settings/branches` | Create branch |
| PATCH | `/settings/branches/{branch}` | Update branch |
| GET | `/settings/integrations` | Masked integration status |
| GET | `/settings/payment-channels` | Safe payment-channel instructions |

## Inputs

Organization settings accept currency, fiscal year month, cutoff time, feature flags, theme mode, language, MFA, email alerts, and session lock. Password change requires `current_password`, `new_password`, and `confirm_password`.

## Outputs

Settings return `{ "settings": OrgSettings }`; integrations return booleans only and never raw secrets.

## Error Handling

- `403 FORBIDDEN`: missing settings permission or cross-branch branch filter.
- `422 VALIDATION_ERROR`: invalid setting values or wrong current password.

## Edge Cases

- Payment-channel branch filters reject another branch for branch-scoped users.
- Profile preferences are stored under user metadata.
- Integration secrets are never returned.

## Acceptance Criteria

- Organization changes are audited.
- Settings branch endpoints reuse the branch controller behavior.
- Password changes never return credentials.
