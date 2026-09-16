# Leads Date Added Report Filter Gap

## Problem

The Leads page has a "Generate Leads Report" dialog where users choose a start date and end date for the field leads report. Users expect this range to filter by the lead's visible "Date Added" value.

Today the frontend report route calls the backend list endpoint like this:

```http
GET /leads?follow_up_from=YYYY-MM-DD&follow_up_to=YYYY-MM-DD&page=1&page_size=100
```

That is not a reliable "date added" filter. The documented backend contract only supports `follow_up_from` and `follow_up_to`, and the report can therefore return leads outside the selected date-added range when the backend ignores those fields or when the stored lead creation date is different from `follow_up_date`.

## Current Frontend Behavior

The frontend normalizes lead rows into `LeadView`:

- `followUpDate` comes from backend `follow_up_date`
- `createdAt` comes from backend `created_at`

The report currently displays "Date Added" as:

```ts
lead.followUpDate || lead.createdAt
```

The table now uses the same visible fallback, so the display is consistent. Filtering still requires backend support so pagination and export totals are correct for the whole dataset.

## Required Backend Contract

Add created/date-added filtering to `GET /leads`.

Recommended query params:

| Param | Type | Behavior |
| --- | --- | --- |
| `date_added_from` | `YYYY-MM-DD` | Include leads whose date-added value is on or after this local date. |
| `date_added_to` | `YYYY-MM-DD` | Include leads whose date-added value is on or before this local date. |

If the backend has a real business field for manually captured "date added", use that field. If not, use `created_at`.

The filtering field must match the value returned to the frontend for display/export. Do not filter by `follow_up_date` unless the backend has intentionally defined `follow_up_date` as the lead capture date.

## Response Requirements

Every lead returned from `GET /leads` and `GET /leads/{id}` should include:

```json
{
  "id": "123",
  "full_name": "Asha Juma",
  "created_at": "2026-08-16T09:20:00.000000Z",
  "follow_up_date": "2026-08-16"
}
```

If `follow_up_date` is not the intended capture/date-added field, keep it as follow-up data and add a dedicated field instead:

```json
{
  "date_added": "2026-08-16"
}
```

Then the frontend can update its adapter to prefer `date_added` over `created_at`.

## Validation

Return `422 VALIDATION_ERROR` when:

- Either date is not `YYYY-MM-DD`
- `date_added_from` is after `date_added_to`

## Acceptance Criteria

- `GET /leads?date_added_from=2026-08-16&date_added_to=2026-09-15` returns only leads added between August 16, 2026 and September 15, 2026, inclusive.
- Pagination metadata reflects the filtered result count.
- The generated report receives only filtered rows from the backend, not all rows.
- The lead rows include a stable date-added value so the Leads table and report show the same date.
- Existing `follow_up_from` and `follow_up_to` behavior remains unchanged for follow-up workflows.

## Frontend Follow-up After Backend Ships

After the backend implements this contract, update `app/api/leads/report/route.ts` to call:

```ts
query: {
  date_added_from: from,
  date_added_to: to,
  branch_id: branchId,
  page: String(page),
  page_size: String(pageSize),
}
```

If the backend adds `date_added`, update `lib/lead-adapters.ts` to map that field into the visible date-added value used by the table and report.
