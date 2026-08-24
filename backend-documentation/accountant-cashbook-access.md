# Accountant cashbook access — backend requirements

The Falco website already exposes the full cashbook UI to accountants at **`/accountant/cashbook`** (same page as super admin `/cashbook`). No separate frontend build is required.

If an accountant user cannot load entries, classify receipts, allocate to loans, or reverse manual rows, the gap is almost always on the **backend user record or API authorization**, not the React app.

## What the frontend grants (by role)

When `GET /api/session` returns `role: "accountant"`, the UI enables:

| Capability | UI |
| --- | --- |
| View cashbook & filters | Cashbook page, opening/cash in/out/closing cards |
| Record manual entries | “New entry” |
| Classify unmatched ClickPesa receipts | Classify sheet (entry type dropdown, branch, category, customer link) |
| Allocate receipt to loan / group | Allocate dialog |
| Reverse manual entries | Reverse dialog with reason |

Branch managers can **view** the cashbook only; accountants and super admin can **manage** it.

## Backend checklist for each accountant user

1. **`role`** must be `accountant` (not `loan_officer`, `branch_manager`, etc.).
2. **`branch_id`** should be set when the accountant works on one branch; dashboard and some filters depend on it.
3. **Permissions** (if the API enforces granular keys beyond role):
   - `financial_entries.view` — list/read cashbook rows
   - `financial_entries.create` — manual cashbook POST
   - `financial_entries.classify` — `PATCH /financial-entries/{id}/classification`
   - `financial_entries.reverse` — `POST /financial-entries/{id}/reverse`
   - `payments.create` — allocate unmatched income to a loan (`POST /financial-entries/{id}/allocate-to-loan`)

The Next.js BFF already allows **`accountant`** role on these routes even when permission keys are missing; the **Falco API** behind the BFF must still accept the same role/permissions or calls return `403`.

## API endpoints to verify (accountant token)

Use a bearer token for the accountant and confirm each returns `200`/`201`, not `403`:

- `GET /financial-entries?from=…&to=…`
- `POST /financial-entries` (manual entry)
- `PATCH /financial-entries/{id}/classification`
- `POST /financial-entries/{id}/allocate-to-loan`
- `POST /financial-entries/{id}/allocate-to-group` (when applicable)
- `POST /financial-entries/{id}/reverse`

## How to test in the app

1. Sign in as the accountant.
2. Confirm redirect lands on `/accountant/dashboard` (not officer/manager portal).
3. Open **Cashbook** from the sidebar or dashboard shortcut → `/accountant/cashbook`.
4. If the page shows “Access denied”, session `role` is not `accountant`.
5. If the page loads but actions fail with an error banner, check browser Network tab for `403` on `/api/financial-entries/*` and fix backend role/permissions.
6. If super admin sees unmatched receipts but accountant sees **0**, see `backend-documentation/accountant-unmatched-cashbook-list-gap.md` — backend list scope for unassigned receipts.

## Security note

Do not share live passwords in tickets or chat. Reset credentials through your normal admin process and verify access with role/permission checks above.
