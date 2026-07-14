# Loan Applications Controller

## Purpose

Loan Applications manage draft intake, required document metadata, submission, review decisions, and final approval into a pending-disbursement loan.

## Endpoints

All endpoints require bearer auth.

Branch scope: applications inherit the customer branch. Super admins may work across branches; branch-scoped users can only create applications for customers in their assigned branch and can only read, update, submit, document, or review applications in that branch. Explicit cross-branch access returns `403 FORBIDDEN`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/applications` | `applications.view` or related application permissions | Paginated application list |
| GET | `/applications/queues` | application permissions | Workflow queue counts |
| POST | `/applications` | `applications.create` | Create draft application |
| GET | `/applications/{id}` | `applications.view` or related application permissions | Detail with documents and child rows |
| PATCH | `/applications/{id}` | `applications.create` | Update editable draft fields |
| PATCH | `/applications/{id}/assign` | application create/review permissions | Assign officer or workflow stage |
| POST | `/applications/{id}/documents` | `applications.create` or `applications.submit` | Attach document metadata or upload file |
| POST | `/applications/{id}/submit` | `applications.submit` | Validate required documents and move to review |
| POST | `/applications/{id}/review` | `applications.review` or `loans.approve` | Approve, reject, or request more info |

## Inputs

`POST /applications`:

```json
{
  "customer_id": "1",
  "product_id": "1",
  "requested_amount": 1000000,
  "term_days": 90,
  "purpose": "Working capital",
  "repayment_frequency": "weekly",
  "collaterals": [{ "type": "inventory", "description": "Retail stock", "estimated_value": 2500000 }],
  "guarantors": [{ "full_name": "Jane Doe", "phone": "255712345678", "relationship": "business_partner" }],
  "references": [{ "full_name": "John Doe", "relationship": "supplier", "phone": "255798765432" }],
  "location": { "latitude": "-6.792400", "longitude": "39.208300", "captured_at": "2026-04-29T12:00:00Z" }
}
```

`PATCH /applications/{id}` supports `requested_amount`, `term_days`, `purpose`, `repayment_frequency`, `metadata`, `location`, `collaterals`, `guarantors`, and `references`. Child arrays use full replacement when included.

`POST /applications/{id}/documents` accepts multipart `file`, `type`, `name`, or JSON `url`, `type`, `name`.

`POST /applications/{id}/review`:

```json
{
  "decision": "approve",
  "approved_amount": 900000,
  "review_notes": "Approved"
}
```

## Outputs

Create/update/show/submit/review return:

```json
{
  "application": {
    "id": "1",
    "application_number": "APP-20260429-000001",
    "status": "draft",
    "loan_mode": "individual",
    "group_id": null,
    "assigned_officer_id": "2",
    "assigned_analyst_id": null,
    "workflow_stage": "loan_officer",
    "requested_amount": 1000000,
    "approved_amount": null,
    "term_days": 90,
    "interest_amount": 180000,
    "total_fees": 30000,
    "total_repayment": 1210000,
    "installment_amount": 403333.33,
    "location": { "latitude": "-6.7924000", "longitude": "39.2083000", "captured_at": "2026-04-29T12:00:00.000000Z" },
    "collaterals": [],
    "guarantors": [],
    "references": [],
    "documents": []
  }
}
```

Final super-admin approval also returns:

```json
{
  "loan": {
    "id": "1",
    "status": "pending_disbursement",
    "principal": 900000,
    "total_outstanding": 1089000
  }
}
```

## Error Handling

- `422 VALIDATION_ERROR` for invalid customer/product, inactive customer, inactive product, product amount/term limits, missing required documents, or invalid status transition.
- `403 FORBIDDEN` when the authenticated user lacks the route permission or attempts cross-branch access.
- `404 NOT_FOUND` when the application, customer, or product does not exist.

## Edge Cases

- Drafts can be edited freely.
- Under-review applications can only be edited after a reviewer requests more info.
- Submitting checks all product-required document types are present.
- Branch-manager approval changes `under_review` to `approved`.
- Super-admin final approval only works from `approved`, changes the application to `pending_disbursement`, and creates one pending-disbursement loan idempotently.
- Rejection is allowed from `under_review` or `approved`.
- Branch isolation is enforced both on route-model endpoints and on create by `customer_id`.
- Queue counts group applications by `workflow_stage`: `loan_officer`, `manager`, `top_admin`, and `completed`.

## Acceptance Criteria

- Multiple collateral, guarantor, reference, and document rows round-trip in create/detail/update responses.
- Application calculations are product-backed and recalculate when amount or term changes.
- Required document validation blocks incomplete submissions.
- Review transitions follow the finite workflow.
- Mutations write audit logs.
