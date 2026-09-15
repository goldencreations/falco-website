# Backend implementation prompt: edit application loan details before loan activation

Implement backend support for editing loan-application terms from the application detail screen.

## Goal

Allow every authenticated application user type that can view an application within its branch scope to edit these fields before the application has created or activated a loan:

- `product_id`
- `requested_amount`
- `term_days`
- `repayment_frequency`
- `purpose`

The frontend calls `PATCH /applications/{applicationId}` using the numeric application database ID. Do not interpret the application number as the route ID.

## Authorization and lifecycle rules

1. Permit super admins, branch managers, loan officers, and other authenticated roles with application-view access to edit these fields, subject to the existing tenant and branch scope checks.
2. The application must belong to a branch the actor is allowed to access. Prevent cross-branch and cross-tenant edits.
3. Allow edits while the application has no linked loan and is in a pre-loan state, including `draft`, `submitted`, `under_review`, or `approved`. If the system permits reopening rejected or cancelled applications, allow the same fields there as well; otherwise return a clear `409` lifecycle error.
4. Reject the update with HTTP `409` when a linked loan already exists, or when the application is `pending_disbursement` or `disbursed`. Perform this check transactionally to prevent an approval/edit race.
5. Do not mutate an existing loan or repayment schedule through this endpoint.

## Validation

- Confirm `product_id` identifies an active product available to the application's branch/customer/loan mode.
- Validate `requested_amount` against the selected product's minimum and maximum.
- Validate `term_days` against the selected product's minimum and maximum.
- Accept only `daily`, `weekly`, `bi_weekly`, or `monthly` for `repayment_frequency`.
- Treat `repayment_frequency` as an application-level override. Do not replace it with the product default when it is explicitly supplied.
- Validate and trim `purpose` using the same constraints as application creation.
- Return HTTP `422` with field-keyed errors for invalid inputs. Do not partially apply a failed update.

## Recalculation and workflow consistency

When any term field changes, recalculate all application preview/derived values from the selected product and the submitted application frequency, including interest, fees, total repayment, installment count, and installment amount. Use the same domain service used by calculator preview and approval. Do not generate or update a loan schedule at this stage.

If business policy requires review to restart after material changes, move `submitted`, `under_review`, or `approved` applications back to the appropriate review state and return the new status. Record this behavior explicitly in the API response and tests. Do not silently retain an approval that is invalid under the changed terms.

## Response

Return HTTP `200` with the complete, freshly persisted application:

```json
{
  "application": {
    "id": "57",
    "product_id": "4",
    "requested_amount": 2500000,
    "term_days": 180,
    "repayment_frequency": "monthly",
    "purpose": "Working capital",
    "status": "under_review",
    "loan_id": null
  }
}
```

The returned `repayment_frequency` must equal the submitted value. Include the recalculated derived fields and product relationship used by the detail screen.

## Concurrency and audit

- Run lifecycle validation, update, and recalculation in one database transaction.
- Lock or version-check the application so final approval cannot create a loan concurrently with an edit.
- Record an audit event containing actor, timestamp, application ID, and before/after values for every changed field.
- Do not log sensitive customer documents or unrelated personal data.

## Required automated tests

1. Each supported user role can update an in-scope pre-loan application.
2. Cross-branch and cross-tenant edits return `403` without revealing data.
3. Monthly remains monthly after update and reload, even for a weekly-default product.
4. Product, amount, term, frequency, and purpose update successfully and derived totals are recalculated.
5. Invalid product constraints and invalid frequencies return field-specific `422` errors.
6. Applications with a linked loan, `pending_disbursement`, or `disbursed` return `409` and remain unchanged.
7. A concurrent final-approval/edit race results in only one valid transaction; an existing loan is never left inconsistent with edited application terms.
8. The response contains the complete updated application and the audit event contains correct before/after values.
