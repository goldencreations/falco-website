# Backend fix: Active loan pricing must match Loan Calculator totals and installment amounts

## Status

- **Installment count policy** — largely addressed (weekly/bi-weekly row count now correct on repaired loans).
- **This gap** — loan **total repayment** and **per-installment amount** on active loans still do not always match the Loan Calculator / spreadsheet formula.

The frontend Loan Calculator (manual and product-backed) now uses the authoritative flat-interest policy documented below. Active loans must persist and return the same numbers from the backend.

Related doc: [active-loan-schedule-installment-count-gap.md](./active-loan-schedule-installment-count-gap.md)

## Problem

After installment count was corrected, active loans can still show wrong **amounts**:

- `loan.installment_amount` differs from Loan Calculator for the same product, principal, and term.
- Schedule row `total_due` differs from calculator installment (e.g. shows 35,000 instead of 35,945).
- `loan.total_repayment` / `loan.total_amount` / `loan.interest_amount` may omit **interest on the processing fee**.
- `principal_interest_amount` and `processing_fee_interest_amount` may be missing or inconsistent with `interest_amount`.

The Active Loan UI renders backend values as source of truth. It does not recalculate pricing.

## Authoritative pricing formula (flat interest)

This is the formula the Loan Calculator and officer spreadsheet use.

Inputs:

- `principal`
- `term_days` → `months = round(term_days / 30)` (minimum 1)
- `interest_rate_per_month` (%)
- `processing_fee_percent` (% of principal)
- `insurance_fee_percent` (% of principal)
- `repayment_frequency` (`weekly`, `bi_weekly`, `monthly`, `daily`)

Computed amounts:

```
processing_fee_amount     = principal × (processing_fee_percent / 100)
insurance_amount          = principal × (insurance_fee_percent / 100)

principal_interest_amount = principal × (interest_rate_per_month / 100) × months
processing_fee_interest   = processing_fee_amount × (interest_rate_per_month / 100) × months

interest_amount           = principal_interest_amount + processing_fee_interest
fees_amount               = processing_fee_amount + insurance_amount

total_repayment           = principal + processing_fee_amount + principal_interest_amount
                          + processing_fee_interest + insurance_amount
```

Installment count:

```
weekly:     repayment_count = months × 4
bi_weekly:  repayment_count = months × 2
monthly:    repayment_count = months
daily:      repayment_count = term_days
```

Installment amount:

```
installment_amount = total_repayment / repayment_count
```

Penalties are **not** included in `installment_amount` or schedule `total_due`. They remain separate on overdue rows.

## Required backend changes

Apply this formula consistently in **all** of the following paths:

1. **Loan disbursement / schedule materialization** — when a loan is created from an approved application.
2. **`POST /calculator/preview`** — must return the same totals as above (frontend calculator now implements this locally; backend should match for API consumers and future use).
3. **`GET /loans`**, **`GET /loans/{id}`** — loan pricing fields populated from stored contract values.
4. **`GET /loans/{id}/schedule`** — each row’s `total_due` equals contractual installment (penalty excluded); component fields sum correctly.

### Loan response fields

Expose and keep consistent:

```json
{
  "principal_amount": 300000,
  "principal_interest_amount": 36000,
  "processing_fee_interest_amount": 7560,
  "interest_amount": 43560,
  "total_fees": 66000,
  "total_repayment": 409560,
  "installment_amount": 51195,
  "repayment_count": 8,
  "repayment_frequency": "weekly",
  "term_days": 60
}
```

Rules:

- `interest_amount` = `principal_interest_amount` + `processing_fee_interest_amount`
- `total_fees` = processing fee + insurance (not including interest)
- `total_repayment` = principal + all fee/interest components as in formula above
- `installment_amount` = `total_repayment / repayment_count`

### Schedule row fields

Each non-penalty installment row:

```json
{
  "installment_number": 1,
  "due_date": "2026-08-14",
  "principal_due": 37500,
  "interest_due": 5445,
  "fees_due": 8250,
  "total_due": 51195,
  "penalty_due": 0
}
```

Rules:

- `total_due` = contractual installment (`installment_amount`), not a partial component sum missing fees/interest-on-processing-fee.
- Sum of all rows’ `principal_due` = `principal_amount`
- Sum of all rows’ `interest_due` = `interest_amount`
- Sum of all rows’ `fees_due` = `total_fees` (processing + insurance)
- Sum of all rows’ `total_due` = `total_repayment` (before penalties)
- Final row may carry rounding remainder so totals reconcile exactly.

## Acceptance tests

### Test A — MICRO-03, 300,000, 60 days, weekly (primary)

Product: **INDIVIDUAL LOAN / MIKOPO BINAFSI (MICRO-03)**

- Interest: **6% / month**, flat
- Processing fee: **21%**
- Insurance: **1%**
- Repayment: **weekly**
- Principal: **300,000**
- Term: **60 days**

Expected:

| Field | Value (TZS) |
|---|---:|
| `months` | 2 |
| `repayment_count` | 8 |
| `processing_fee_amount` | 63,000 |
| `insurance_amount` | 3,000 |
| `principal_interest_amount` | 36,000 |
| `processing_fee_interest_amount` | 7,560 |
| `interest_amount` | 43,560 |
| `total_repayment` | **409,560** |
| `installment_amount` | **51,195** |

Pass when `GET /loans/{id}` and every schedule row (excluding penalty) match these values.

### Test B — Spreadsheet row, 300,000, 90 days, weekly, 3.5%, 20%, 1%

Expected:

- `repayment_count` = 12
- `total_repayment` = **400,800**
- `installment_amount` = **33,400**

### Test C — Calculator preview parity

For the same inputs, `POST /calculator/preview` (product-backed and manual) must return identical `total_repayment`, `installment_amount`, and `repayment_count` as Test A/B.

### Test D — Legacy repair preserves payments

For an already-disbursed loan with posted payments:

- Repaired schedule keeps `total_paid` / allocation history intact.
- `total_outstanding` and row `balance_due` remain correct after repair.
- No duplicate or orphaned payment allocations.

## Legacy repair

For existing active loans with wrong stored amounts:

1. Detect loans where `installment_amount` or sum of schedule `total_due` ≠ expected formula for stored principal, term, product rates.
2. Dry-run diff report (before/after totals and row amounts).
3. Rebuild schedule amounts per row using the formula above; keep due dates and installment count unless count was also wrong.
4. Update loan header fields: `interest_amount`, `principal_interest_amount`, `processing_fee_interest_amount`, `total_repayment`, `installment_amount`, `total_amount`.
5. Reconcile outstanding balances; do not alter completed payment ledger entries.

## Frontend behaviour after fix

- **Loan Calculator** — already uses this formula for manual and product-backed preview.
- **Active Loan page** — continues to display backend loan + schedule fields; no frontend recalculation.
- After backend repair, officers should see the same installment and total loan in Calculator and Active Loan for the same contract.

## Out of scope

- Penalty accrual logic (unchanged; remains separate from contractual installment).
- Declining-balance products (MICRO-03 and officer spreadsheet use **flat interest** only).
