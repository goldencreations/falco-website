# Backend prompt: Fix orphan `branch_id` values (staff + customers invisible across branches)

Copy/paste this to the backend team.

---

## Problem

Some staff accounts and customer records use a **`branch_id` that does not match any row in `GET /branches`**.

Example seen in production/UAT:

| Field | Value on user record | Value in branch list |
| --- | --- | --- |
| Staff `branch_id` | `branch-dom01` | *(no such branch)* |
| Real branches | — | **FALCO HEAD OFFICE** (`FALCO 01`), **FALCO MBAGALA BRANCH**, … |

When **filbert.pamba@falco.co.tz** (loan officer) creates a customer:

1. Frontend `POST /customers` sets `branch_id` from the authenticated user's token branch (`branch-dom01`) — see frontend proxy below.
2. The customer is stored under `branch_id = branch-dom01`.
3. The **Mbagala branch manager** lists customers with `branch_id = <their real branch id/code>`.
4. **No overlap** → manager cannot see the customer, dashboards/metrics are wrong, and ops think data was “lost”.

This is **not** a frontend display bug. The UI correctly shows that the staff account references a branch key that is not in the branch catalogue. The root cause is **stale/invalid branch assignment in Laravel**.

---

## How branch scoping works (must stay consistent)

Branch-scoped roles: `loan_officer`, `branch_manager`, `accountant`, `credit_analyst`, `collections_officer`, etc. (everyone except `super_admin` with a branch).

| Action | Backend rule |
| --- | --- |
| `GET /customers?branch_id=…` | Branch user may only query **their own** `branch_id` from token |
| `POST /customers` | If body omits `branch_id`, use actor's branch; reject if body sends another branch |
| `GET /api/me` | Must return the same `branch_id` used for scoping everywhere |
| List loans, applications, payments, metrics | Same branch filter semantics |

Frontend proxy (already deployed):

```ts
// POST /api/customers — branch-scoped users
if (isBranchDataScoped(user)) {
  apiBody.branch_id = user.branch_id.trim();
}
```

So **whatever `/api/me` returns as `branch_id` is what new customers get**.

---

## Required backend fixes

### 1. Data repair — staff users

Find users whose `branch_id` is **not** a valid branch `id` or `code`:

```sql
-- Pseudocode / adapt to your schema
SELECT u.id, u.email, u.role, u.branch_id
FROM users u
LEFT JOIN branches b
  ON b.id = u.branch_id OR b.code = u.branch_id
WHERE u.branch_id IS NOT NULL
  AND u.branch_id <> ''
  AND b.id IS NULL;
```

For each row (e.g. `filbert.pamba@falco.co.tz` with `branch-dom01`):

- Reassign to the **canonical branch primary key** from `branches` (e.g. the id for **FALCO MBAGALA BRANCH**).
- Prefer storing the same identifier everywhere: either always `branches.id` or always `branches.code` — but pick **one** and document it.

After fix, `GET /api/me` for that user must return the corrected `branch_id` and ideally `branch_name`:

```json
{
  "user": {
    "email": "filbert.pamba@falco.co.tz",
    "role": "loan_officer",
    "branch_id": "<canonical-mbagala-id>",
    "branch_name": "FALCO MBAGALA BRANCH"
  }
}
```

### 2. Data repair — customers (and related records)

Find customers stuck on orphan branch keys:

```sql
SELECT c.id, c.customer_number, c.full_name, c.branch_id
FROM customers c
LEFT JOIN branches b
  ON b.id = c.branch_id OR b.code = c.branch_id
WHERE c.branch_id IS NOT NULL
  AND b.id IS NULL;
```

Remap `customers.branch_id` (and **`applications`**, **`loans`**, **`leads`**, **`groups`**, etc. if any share the orphan key) to the same canonical branch id the officer should have been on (e.g. Mbagala).

Provide an **audit log** or migration report: old key → new key, record counts per table.

### 3. Validation — prevent recurrence

On **user create/update** and **staff provisioning approve**:

- Reject `branch_id` that does not resolve to an existing active branch (`422 VALIDATION_ERROR`).
- Do not accept legacy slugs like `branch-dom01` unless they exist in `branches`.

On **`POST /customers`** (and other branch-stamped creates):

- Resolve actor branch through the same branch lookup (id **or** code).
- If actor's `branch_id` is orphan → **`403` or `422`** with a clear message: *“User branch assignment invalid; contact administrator.”*
- Do **not** silently create customers under a dead branch key.

On **`GET /api/me`**:

- Include `branch_name` from the joined branch row when `branch_id` is valid.
- If `branch_id` is invalid, consider failing login or returning a dedicated flag so ops can fix the account (optional but strongly recommended).

### 4. Branch identifier contract (document and enforce)

Document one rule for all APIs:

```text
branch_id on users, customers, loans, … MUST equal branches.id
OR MUST equal branches.code — pick one canonical form
```

Frontend matches using normalized comparison of **both** `id` and `code` when resolving display names, but **list filters use exact token branch_id**. Mixed/id-vs-code storage causes invisible data even when branches “look” the same on screen.

**Recommendation:** Store **`branches.id`** everywhere; expose `branch_code` separately for display only.

---

## Acceptance criteria

1. **filbert.pamba@falco.co.tz** `GET /api/me` returns a `branch_id` that exists on `GET /branches` (Mbagala).
2. Same user creates a customer → `GET /customers` as Mbagala branch manager includes that customer without super-admin intervention.
3. No staff user in production has `branch_id` pointing to a non-existent branch (monitoring query returns 0 rows).
4. No customer/application/loan rows reference orphan branch keys after migration (or documented exceptions with repair plan).
5. New user provisioning cannot save an invalid `branch_id`.
6. `GET /api/me` includes human-readable `branch_name` for valid assignments.

---

## Verification script (suggested)

Run after migration:

```bash
# 1) Me — officer
curl -s -H "Authorization: Bearer $OFFICER_TOKEN" https://<api>/api/me | jq '.user | {email, branch_id, branch_name}'

# 2) Branches — confirm id exists
curl -s -H "Authorization: Bearer $OFFICER_TOKEN" https://<api>/branches | jq '.branches[] | {id, code, name}'

# 3) Manager lists customers — should include officer-created rows
curl -s -H "Authorization: Bearer $MANAGER_TOKEN" "https://<api>/customers?page_size=50" | jq '.data | length'

# 4) Orphan audit — should return empty
# (run SQL above on production read-replica)
```

---

## Frontend behaviour (for context — no change required on backend after fix)

- Header/settings branch label resolves from `GET /branches` + session; orphan keys show **“Branch not linked”** instead of pretending `branch-dom01` is a name.
- Customer create always stamps the officer's token `branch_id`.
- Branch manager lists are filtered server-side to the manager's token `branch_id`.

Once backend assignment and historical data are corrected, manager visibility and branch labels work without further frontend changes.

---

## Out of scope

- Frontend inventing branch ids or remapping customers between branches without an authenticated admin API.
- Display-only aliases (e.g. showing “Mbagala” while storage still uses `branch-dom01`).

---

## Definition of done

**filbert.pamba@falco.co.tz** is assigned to **FALCO MBAGALA BRANCH**, creates a customer, and the **Mbagala branch manager** sees that customer in `GET /customers` on first refresh. Orphan-branch audit query returns zero rows for users and customers.

---

Thanks.
