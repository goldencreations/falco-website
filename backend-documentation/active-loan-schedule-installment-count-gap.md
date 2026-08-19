# Backend gap: Active loan schedule installment count mismatch

## Problem

For weekly loans, the Active Loan page (`GET /loans/{id}/schedule`) can return a schedule with more installments than Falco policy expects.

Observed case:

- Disbursed principal: **TSh 1,000,000**
- Product: **INDIVIDUAL LOAN / MIKOPO BINAFSI (MICRO-03)**
- Term: **60 days**
- Repayment frequency: **weekly**
- Expected installments by policy: **8**
- Returned schedule rows: **9** (e.g. due dates from 15 Aug 2026 to 10 Oct 2026)

This causes visible confusion between:

- Loan Calculator product-backed preview (policy-driven expectation), and
- Active Loan repayment schedule (backend-generated/stored schedule).

## Expected business rule

Falco policy for weekly and bi-weekly schedules is month-based on a 30-day month:

- `months = round(term_days / 30)`
- Weekly installments: `months * 4`
- Bi-weekly installments: `months * 2`

For 60 days:

- `months = 2`
- Weekly installments = `2 * 4 = 8`

## Actual behavior

Backend schedule for the affected active loan behaves like a day-based rule (or equivalent), resulting in 9 rows for what should be an 8-installment weekly plan.

## Scope of gap

This is a backend schedule generation/storage consistency issue in the active-loan schedule source.

Frontend note:

- Active Loan page renders backend schedule as-is.
- Frontend does not generate authoritative repayment rows for active loans.

## Required backend fix

Ensure schedule generation and persisted schedule rows follow the same installment-count rule as product policy:

1. Use policy-consistent installment count for weekly/bi-weekly (`months*4`, `months*2`).
2. Regenerate schedule rows for newly disbursed loans using this rule.
3. For already-affected loans, provide a safe correction path (data repair/rebuild script) where permitted by business controls.
4. Keep repayment allocation integrity when schedule rows are corrected (no loss of payment history).

## Verification checklist

For a weekly, 60-day, 1,000,000 TSh loan on MICRO-03:

1. `GET /loans/{id}` confirms:
   - `term_days = 60`
   - `repayment_frequency = weekly`
2. `GET /loans/{id}/schedule` returns exactly **8** installments.
3. Sum of installment principal/interest/fees equals loan contractual totals.
4. If there are payments already posted, allocations still reconcile after schedule correction.
5. Loan Calculator product-backed preview and active schedule show consistent installment count/amount basis.

## Suggested acceptance criteria

1. **New weekly 60-day loans** generate 8 schedule rows.
2. **Existing mis-generated loans** can be corrected through approved migration/rebuild flow.
3. No double-counting or orphaned allocations after correction.
4. API responses remain backward compatible in shape; only corrected values/counts change.

## Additional product QA example

Use this as a concrete product-consistency test case:

- Disbursed date: **07 Aug**
- Maturity date: **06 Nov**
- Product-backed expectation: **12 installments**
- Disbursed principal: **TSh 300,000**
- Expected installment amount (per calculator for this product setup): **TSh 35,945**

Pass condition:

- `GET /loans/{id}/schedule` returns 12 rows for this loan.
- Per-row installment basis (principal+interest+fees) aligns with TSh 35,945 (normal rounding tolerance allowed if backend applies final-row balancing).

## Engineering handoff: safe repair strategy

### 1) Identify impacted loans

Target only loans where policy and stored schedule count disagree.

Selection rule:

- `repayment_frequency IN ('weekly', 'bi_weekly')`
- loan is still active (`active`, `in_arrears`, or equivalent payable status)
- expected count by policy:
  - weekly: `round(term_days / 30) * 4`
  - bi-weekly: `round(term_days / 30) * 2`
- actual count from schedule rows != expected count

### 2) Dry-run diff first (no writes)

For each impacted loan, produce a comparison artifact:

- loan id / loan number / branch / product
- current row count vs expected row count
- current due-date list
- proposed due-date list
- current per-row principal/interest/fees totals
- proposed per-row principal/interest/fees totals
- payment allocation impact summary:
  - rows with posted allocations
  - rows that would be merged/split

Require finance sign-off on this dry-run report before mutation.

### 3) Rebuild in a transaction per loan

For each approved loan:

1. Lock loan + schedule + allocation/payment rows (`SELECT ... FOR UPDATE`).
2. Snapshot old schedule and linked allocation references to an audit table.
3. Generate corrected schedule using policy installment count.
4. Re-map already-posted allocations onto corrected rows by deterministic rule:
   - preserve total paid per component (`penalty`, `fees`, `interest`, `principal`)
   - preserve chronological order of payments
   - never create or delete payment ledger entries
5. Recompute per-row balances and loan summary fields.
6. Commit; on any mismatch, rollback entire loan transaction.

### 4) Reconciliation checks (hard gates)

After each loan rebuild, verify:

- `sum(schedule.principal_due) == loan.principal_amount`
- `sum(schedule.interest_due) == loan.interest_amount` (or contractual expected interest)
- `sum(schedule.fees_due) == loan.total_fees` (or expected fees)
- `sum(applied principal+interest+fees+penalty)` unchanged pre vs post
- `loan.total_paid` unchanged
- `loan.total_outstanding` unchanged (unless prior schedule bug caused incorrect derived value and this is explicitly intended to correct)
- no orphaned references from payment allocations to removed schedule rows

Abort and flag if any check fails.

### 5) Auditability and rollback

Create/retain:

- `schedule_repair_runs` (run metadata: who, when, code version, filters)
- `schedule_repair_items` (loan-level before/after JSON blobs + status)
- row-level mapping table (`old_schedule_row_id -> new_schedule_row_id`)

Rollback options:

- per-loan rollback from snapshot
- full-run rollback by run id

### 6) API and UI behavior during migration

- Keep `GET /loans/{id}/schedule` response shape unchanged.
- Optionally expose temporary metadata for support/debug:
  - `schedule_version`
  - `schedule_repaired_at`
  - `schedule_repair_run_id`

### 7) Suggested SQL skeleton (illustrative only)

```sql
-- 1) Candidate detection (pseudo-SQL: adapt table/column names)
WITH base AS (
  SELECT
    l.id,
    l.loan_number,
    l.repayment_frequency,
    l.term_days,
    CASE
      WHEN l.repayment_frequency = 'weekly' THEN ROUND(l.term_days / 30.0) * 4
      WHEN l.repayment_frequency = 'bi_weekly' THEN ROUND(l.term_days / 30.0) * 2
      ELSE NULL
    END AS expected_count
  FROM loans l
  WHERE l.repayment_frequency IN ('weekly', 'bi_weekly')
    AND l.status IN ('active', 'in_arrears')
),
actual AS (
  SELECT s.loan_id, COUNT(*) AS actual_count
  FROM loan_repayment_schedules s
  GROUP BY s.loan_id
)
SELECT b.*, a.actual_count
FROM base b
JOIN actual a ON a.loan_id = b.id
WHERE b.expected_count IS NOT NULL
  AND a.actual_count <> b.expected_count;
```

```sql
-- 2) Back up impacted schedule rows before any update
INSERT INTO loan_schedule_backup (loan_id, schedule_payload, backed_up_at, backup_reason)
SELECT
  s.loan_id,
  JSON_ARRAYAGG(
    JSON_OBJECT(
      'id', s.id,
      'installment_no', s.installment_number,
      'due_date', s.due_date,
      'principal_due', s.principal_due,
      'interest_due', s.interest_due,
      'fees_due', s.fees_due,
      'penalty_due', s.penalty_due
    )
  ),
  NOW(),
  'weekly/bi-weekly installment count repair'
FROM loan_repayment_schedules s
WHERE s.loan_id IN (/* impacted ids */)
GROUP BY s.loan_id;
```

> Note: exact table/column names will vary in LMS. Use this as a shape, not copy-paste SQL.

