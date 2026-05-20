# Collections Controller

## Purpose

Collections endpoints let staff view delinquency follow-up activity, log append-only actions, and work a prioritized queue of overdue loans.

Branch scope: collection activity and queue rows are scoped through the loan branch. Super admins may access all branches; branch-scoped users only see and mutate loans in their assigned branch. Cross-branch loan IDs or filters return `403 FORBIDDEN`.

## Endpoints

### `GET /collections/activities`

Returns paginated collection activities.

Query inputs: `loan_id`, `customer_id`, `action`, `from`, `to`, `branch_id`, `page`, `page_size`.

Output:

```json
{
  "data": [
    {
      "id": "1",
      "loan_id": "10",
      "customer_id": "5",
      "action": "phone_call",
      "notes": "Customer promised to pay",
      "outcome": "PTP accepted",
      "follow_up_date": "2026-05-04",
      "performed_by": "2",
      "performed_at": "2026-04-30T08:00:00.000000Z",
      "metadata": {}
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

### `POST /collections/activities`

Logs a follow-up action. The backend derives `customer_id`, `performed_by`, and `performed_at`.

Input:

```json
{
  "loan_id": "10",
  "action": "promise_to_pay",
  "notes": "Customer promised to pay on Friday.",
  "outcome": "PTP accepted",
  "follow_up_date": "2026-05-04"
}
```

Valid actions: `phone_call`, `sms`, `visit`, `promise_to_pay`, `ussd_push`, `escalation`, `restructure_discussion`, `other`.

Output `201`:

```json
{
  "activity": {
    "id": "1",
    "loan_id": "10",
    "customer_id": "5",
    "action": "promise_to_pay",
    "notes": "Customer promised to pay on Friday.",
    "outcome": "PTP accepted",
    "follow_up_date": "2026-05-04",
    "performed_by": "2",
    "performed_at": "2026-04-30T08:00:00.000000Z"
  }
}
```

### `GET /collections/queue`

Returns overdue loans ordered by risk classification, days in arrears, and outstanding balance.

Output:

```json
{
  "data": [
    {
      "loan_id": "10",
      "loan_number": "LN-000001",
      "customer_id": "5",
      "customer_name": "Asha Musa",
      "days_in_arrears": 14,
      "risk_classification": "high",
      "total_outstanding": 450000,
      "last_activity_at": "2026-04-29 10:00:00"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

## Error Handling

- `401`: missing or invalid bearer token.
- `403`: authenticated user lacks `collections.view`/`collections.create`, or attempts cross-branch access.
- `422`: invalid action, missing notes, invalid loan, past follow-up date, or loan has no outstanding balance.

## Edge Cases

- Activities are append-only; no update or delete endpoint is exposed.
- `customer_id` always comes from the loan to avoid mismatched activity records.
- Paid-off loans cannot receive new collection activity.
- Queue excludes active, paid-off, written-off, and zero-balance loans.
- Queue and activity listing automatically apply the authenticated user's branch scope.

## Acceptance Criteria

- Staff with collection permissions can log and list activities.
- Promise-to-pay dates are stored as `follow_up_date`.
- Queue prioritizes risky delinquent loans.
- Every logged activity is audit logged.
