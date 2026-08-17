# Backend fix: Group ClickPesa allocation must accept vikundi member loans

## Problem

`POST /financial-entries/{id}/allocate-to-group` returns `422` with:

> The selected loan does not belong to this group.

This happens for real vikundi collections.

Example: unmatched ClickPesa receipt `FIN-20260817-B6BAC4` (TSh 162,162, payer **UAMINIFU GROUP**). The operator selected the Falco group **Uaminifu** at FALCO MBAGALA BRANCH and split the receipt across two payable member loans:

| Member | Loan | Outstanding | Allocation |
| --- | --- | --- | ---: |
| Happyness James | `LN-APP-20260714-366403` | TSh 326,075 | 90,772 |
| Mohamed Kwepu | `LN-APP-20260713-415351` | TSh 256,455 | 71,390 |

The split sums to the original receipt. The borrowers are current Uaminifu members. The API still rejected the loans.

The frontend now hides those rows, because submitting them cannot succeed. That is a workaround, not the intended product.

## Why the current check is wrong

Falco vikundi member lending is **individual loans owned by members**, not a single `group_based` loan.

- Member applications are created with `POST /applications`, `loan_mode=individual`, and optional `group_id` for linkage only.
- Accountants must not use `POST /groups/{group}/applications` for member loans.
- `POST /groups/{group}/applications` is the separate chairperson / `loan_mode=group_based` path.
- Collections already treats a loan as part of a group if **either** `loan.group_id` matches **or** the borrower is a current group member (`left_at` is null).

Allocate-to-group currently appears to require the **loan row** to already belong to the group (`loan.group_id` and/or `loan_mode=group_based`). That excludes the normal vikundi book: member individual loans, often with `group_id` null on the loan even when the application sent `group_id`.

A group ClickPesa payer name (for example `UAMINIFU GROUP`) is one receipt that must be split across those member loans.

## Required belonging rule

A loan belongs to the selected group for allocation when **all** of the following are true:

1. The group exists, is `active`, and is in the given `branch_id`.
2. The loan is `active` or `in_arrears`.
3. The loan customer is a **current** member of that group (`left_at` is null), **or** `loan.group_id` equals the selected group, **or** `loan.loan_mode=group_based` and `loan.group_id` equals the selected group.
4. The allocation amount is `> 0` and does not exceed that loan’s `total_outstanding`.

Do **not** reject a loan only because:

- `loan.group_id` is null;
- `loan.loan_mode` is `individual`;
- the loan was created via `POST /applications` rather than `POST /groups/{group}/applications`.

Still reject when:

- the customer is not a current member and the loan is not tagged to this group;
- the customer `left_at` the group;
- the loan is in another group;
- the loan is in another branch;
- the loan is not payable (`draft`, `paid_off`, `written_off`, etc.).

## Persistence fix (do this as well)

On application approval / loan create, copy `application.group_id` onto `loan.group_id` when present.

That keeps reporting, collections, and allocation aligned. It does **not** replace the membership rule above. Existing member loans with null `group_id` must still allocate.

Optional backfill:

```sql
-- Sketch only; use the real table/column names.
UPDATE loans l
SET group_id = a.group_id
FROM applications a
WHERE l.application_id = a.id
  AND l.group_id IS NULL
  AND a.group_id IS NOT NULL;
```

## Endpoint contract

`POST /financial-entries/{entryId}/allocate-to-group`

Permissions: same as allocate-to-loan (`payments.create` / accountant / super_admin).

### Request

Do not require a top-level `amount`. The receipt amount on the unmatched financial entry is the source of truth. The frontend must not `POST /payments`.

```json
{
  "branch_id": "branch-dom01",
  "group_id": 12,
  "notes": "Verified against the ClickPesa merchant receipt 26393146960132",
  "allocations": [
    { "loan_id": 81, "customer_id": 33, "amount": 90772 },
    { "loan_id": 82, "customer_id": 34, "amount": 71390 }
  ]
}
```

Field name is **`allocations`** (plural).

Each row:

| Field | Required | Rule |
| --- | --- | --- |
| `loan_id` | yes | Payable loan that belongs to the group under the rule above |
| `customer_id` | yes | Must be the loan’s customer |
| `amount` | yes | Integer TZS, `> 0`, `<= loan.total_outstanding` |

### Amount checks

- `sum(allocations.amount)` must equal the original unmatched entry amount exactly.
- Do not allow the operator to change the receipt total.
- Reject if the sum exceeds group outstanding or any single loan outstanding.

### Atomic behaviour (same as allocate-to-loan, per loan)

For each allocation row, in one transaction:

1. Create a verified Payment for that loan using the row amount (not a second cashbook post from the client).
2. Allocate penalty → fees → interest → principal.
3. Update loan balances and schedule.
4. Post the system `loan_repayment` cashbook row if that is how individual allocate-to-loan works today.

After all rows succeed:

5. Reverse or supersede the original unmatched ClickPesa financial entry.
6. Return `201`, or `200` with `already_allocated=true` if this entry was already allocated. Do not create a second payment set.

If any row fails, roll back the whole request.

## Validation messages

Keep Laravel-style `422` details with a `field` so the cashbook sheet can highlight the row.

| Condition | Field | Message |
| --- | --- | --- |
| Missing `allocations` | `allocations` | The allocations field is required. |
| Empty `allocations` | `allocations` | Split the receipt across at least one group loan. |
| Sum ≠ receipt amount | `allocations` | The allocations must equal the original receipt amount. |
| Loan not payable | `allocations.0.loan_id` | The selected loan cannot accept a repayment. |
| Customer is not a current member and loan is not tagged to this group | `allocations.0.loan_id` | The selected loan does not belong to this group. |
| Amount exceeds outstanding | `allocations.0.amount` | The amount exceeds this loan’s outstanding balance. |
| `customer_id` does not match the loan | `allocations.0.customer_id` | The customer does not match the selected loan. |

Do not use “does not belong to this group” for a current member’s individual loan.

## Response

`201 Created` (or `200` when `already_allocated=true`):

```json
{
  "already_allocated": false,
  "group_id": 12,
  "allocations": [
    {
      "payment_id": 44,
      "loan_id": 81,
      "customer_id": 33,
      "amount": 90772,
      "penalty_allocated": 0,
      "fees_allocated": 0,
      "interest_allocated": 0,
      "principal_allocated": 90772
    },
    {
      "payment_id": 45,
      "loan_id": 82,
      "customer_id": 34,
      "amount": 71390,
      "penalty_allocated": 0,
      "fees_allocated": 0,
      "interest_allocated": 0,
      "principal_allocated": 71390
    }
  ]
}
```

## Acceptance tests

1. **Uaminifu case.** Unmatched ClickPesa inflow, group Uaminifu, Happyness + Mohamed individual member loans with null `loan.group_id`. Split 90772 + 71390 = 162162. Expect `201`, two payments, original unmatched row reversed/superseded, both loan `total_paid` / outstanding updated.
2. **Idempotent replay.** Same entry again returns `200` `{ "already_allocated": true }` and does not create more payments.
3. **Left member.** A customer with `left_at` set and no `loan.group_id` is rejected.
4. **Other group’s loan.** A loan tagged to a different `group_id` is rejected.
5. **Over-outstanding.** Amount above one loan’s outstanding is `422`.
6. **Sum mismatch.** Allocations that do not equal the receipt amount are `422`.
7. **group_based loan.** A chairperson `loan_mode=group_based` loan with matching `group_id` still allocates.
8. **No `POST /payments` from the client** is required; this endpoint creates the payments.

## Frontend behaviour after this ships

Cashbook **Allocate repayment → Group loans** will show current members’ payable individual loans again, including rows with null `loan.group_id`, and will keep posting the payload above.
