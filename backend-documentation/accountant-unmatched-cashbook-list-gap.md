# Backend gap — accountant cannot see unmatched ClickPesa cashbook queue

## Symptom

- **Super admin** (`/cashbook`): banner shows e.g. “19 unmatched ClickPesa receipts need classification”, entries such as `FIN-20260821-717A5B`, `FIN-20260821-E2BC23`, `FIN-20260821-4CDA5A` appear under **Unmatched / Needs investigation**.
- **Accountant** (`/accountant/cashbook`): same date range and UI, but **0 unmatched** (or only branch-assigned rows). Automatic loan repayments may still appear; the **unclassified gateway income queue does not**.

The website uses the **same React page** and the same BFF route (`GET /api/financial-entries`) for both roles. The frontend sends `needs_classification=1`, `source=clickpesa`, and `status=posted` without a branch filter for accountants.

## Root cause (backend)

Unmatched ClickPesa receipts are typically stored as:

- `source`: `clickpesa` / gateway
- `category`: `unclassified_gateway_income` (or `unclassified`)
- `branch_id`: **`null`** until an accountant classifies and assigns a branch
- `metadata.unmatched`: `true`
- `metadata.classification`: `unclassified_gateway_income`

Super admin list queries return **org-wide** rows including `branch_id IS NULL`.

Accountant JWT list queries appear to apply **branch scoping** (or a permission gate) that **excludes unassigned unmatched receipts**, so the queue looks empty even though classify permissions exist on the BFF.

This is **not** a missing frontend menu or accountant portal route.

## Required backend behaviour

For `GET /financial-entries` when the caller has role **`accountant`** (or permission `financial_entries.classify`):

1. **Unmatched / needs-classification queue** (`needs_classification=1`, or `source=clickpesa` + `status=posted` + unclassified category) must return the **same org-wide unassigned queue** super admin sees, **or** at minimum:
   - all rows where `branch_id IS NULL` and receipt is unmatched ClickPesa income, **plus**
   - rows where `branch_id` equals the accountant’s branch (if branch-scoped accountants are desired).
2. Do **not** require `branch_id` query param for accountants to see unassigned receipts.
3. Grant **`financial_entries.view`** (and classify/allocate permissions) on the accountant role in `config/permissions.php` (or equivalent) if the API checks granular keys.

### Suggested API contract

Support (either name is fine):

```
GET /financial-entries?needs_classification=1&source=clickpesa&status=posted&from=&to=&page_size=500
```

Rules:

| Role | Unmatched queue scope |
| --- | --- |
| `super_admin` | Org-wide (optional `branch_id` filter) |
| `accountant` | Org-wide unassigned unmatched **required**; optional filter to own branch for classified rows only |
| `branch_manager` | Own branch only |

## Verification (compare tokens)

Run the **same query** with admin vs accountant bearer tokens:

```http
GET /financial-entries?needs_classification=1&source=clickpesa&status=posted&from=2026-07-22&to=2026-08-22&page=1&page_size=500
Authorization: Bearer <token>
```

**Pass when:**

- Accountant response includes the same entry numbers admin sees (e.g. `FIN-20260821-717A5B`).
- `meta.total` (if present) matches within rounding for the same date window.

**Fail when:**

- Accountant returns `403` → permission gap (`financial_entries.view` / role policy).
- Accountant returns `200` with `data: []` while admin returns 19 rows → branch/unassigned scope gap.

## Frontend mitigations already in place

- Merges unmatched probe into the **All** tab (admin and accountant).
- Sends `needs_classification=1` through the BFF to the Falco API.
- BFF forces **no `branch_id`** on unmatched queue requests for accountants.
- BFF merges legacy `category=unclassified_gateway_income` probe when the primary query returns fewer rows (works only if backend exposes at least one shape).

**Full fix still requires backend list authorization for accountants.**

## Related docs

- `backend-documentation/accountant-cashbook-access.md` — role, permissions, classify/allocate endpoints
