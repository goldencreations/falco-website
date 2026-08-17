# Frontend Guide: ClickPesa Cashbook Automatic Classification

## Purpose

Implement the Cashbook UI for ClickPesa cash-in after the backend automatic-classification fixes.

Previously, ClickPesa receipts could appear as `unclassified_gateway_income` even when the customer existed in Falco. Staff then had to manually enter the customer, branch, and category.

For future `PAYMENT RECEIVED` transactions, the backend now attempts to identify and post the receipt automatically:

- current Falco BillPay reference match;
- or a safe legacy match using an exact phone, normalized full name, and exactly one Falco customer;
- payable loan → create Payment and classify system cashbook entry as `loan_repayment`;
- unpaid registration fee → create registration-fee Payment and classify system cashbook entry as `registration_fee`;
- ambiguous or unknown identity → failed webhook event for investigation, not a guessed customer allocation.

The frontend must display the backend classification. It must not create a second Cashbook entry.

## Expected backend accounting flow

### Loan repayment

```text
ClickPesa PAYMENT RECEIVED
    → customer matched
    → active/in-arrears loan found
    → Payment created and allocated
    → system FinancialEntry created
       source=system
       category=loan_repayment
       direction=inflow
       status=posted
```

### Registration fee

```text
ClickPesa PAYMENT RECEIVED
    → customer matched
    → no payable loan
    → registration fee unpaid
    → registration-fee Payment created
    → system FinancialEntry created
       source=system
       category=registration_fee
       direction=inflow
       status=posted
```

### Historical conversion

```text
Legacy source=clickpesa entry
    → reconciliation safely matches customer
    → proper Payment created
    → legacy entry status becomes reversed
    → replacement source=system entry becomes posted
```

The legacy and replacement entries must not both count in posted Cashbook totals.

## Cashbook endpoint

Use the existing Cashbook endpoint:

```http
GET /financial-entries?page=1&page_size=50
Authorization: Bearer <token>
Accept: application/json
```

Continue using existing branch, category, source, status, and date filters supported by the screen/API.

## Row classification and labels

### Automatically classified loan repayment

Backend characteristics:

```json
{
  "source": "system",
  "category": "loan_repayment",
  "direction": "inflow",
  "status": "posted",
  "payment_method": "gateway",
  "metadata": {
    "payment_id": "44",
    "loan_id": "21",
    "external_reference": "CLICKPESA-PAYMENT-REFERENCE"
  }
}
```

Display category **Loan repayment**, show the actual provider from `account_name` (for example **Tigo Pesa**, **M-Pesa**, **Airtel Money**, **NMB**, or **CRDB**) as the Method, and show a separate **Automatic** badge. Fall back to **Gateway** only when no provider is returned.

Do not show a manual classification action.

### Automatically classified registration fee

Backend characteristics:

```json
{
  "source": "system",
  "category": "registration_fee",
  "direction": "inflow",
  "status": "posted",
  "payment_method": "gateway"
}
```

Display category **Registration fee**, show the actual provider/channel as the Method, and show a separate **Automatic** badge.

Do not show a manual classification action.

### Superseded legacy entry

Backend characteristics:

```json
{
  "source": "clickpesa",
  "status": "reversed",
  "reversal_reason": "Superseded by an automatically allocated ClickPesa payment."
}
```

Display label: **Superseded by automatic payment**.

- Exclude it from posted inflow totals.
- Keep it visible in audit/history views.
- Do not allow classification, deletion, or another conversion.

### Historical unclassified entry

Backend characteristics:

```json
{
  "source": "clickpesa",
  "category": "unclassified_gateway_income",
  "direction": "inflow",
  "status": "posted"
}
```

Display label: **Needs investigation**.

An old unclassified entry does not automatically mean the customer is missing. It may be waiting for reconciliation, have an ambiguous legacy identity, use a group name, or belong to a customer without a payable loan/registration fee.

Do not label it **Loan repayment** until the backend creates a proper Payment.

## When manual classification is appropriate

Manual Cashbook classification remains appropriate only when finance confirms the receipt is accounting income that should not reduce a loan, for example an approved fee or another income category.

Manual classification must not be used to apply money to a loan. The Cashbook classification endpoint does not allocate repayment schedules or reduce loan outstanding.

Before allowing manual classification, show:

> This action classifies accounting income only. It does not credit a loan or update a repayment schedule.

Require:

- branch;
- category;
- explanation/notes;
- customer only when finance has confirmed the customer relationship;
- final confirmation.

## Verified unmatched receipt allocation to a loan

When finance confirms that an unclassified ClickPesa receipt belongs to a specific customer and loan, global administrators can use:

```http
POST /financial-entries/{id}/allocate-to-loan
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "branch_id": "branch-dom01",
  "customer_id": 33,
  "loan_id": 21,
  "notes": "Verified against the ClickPesa merchant receipt"
}
```

Before enabling the action, require the operator to select a branch, customer, and active/in-arrears loan and enter verification notes. Show the immutable receipt amount, payment reference, payer, payment date, and provider in a confirmation dialog.

Do not send an amount from the frontend. The backend always uses the original ClickPesa receipt amount and rejects allocation when it exceeds the selected loan outstanding balance.

On `201`, display the returned allocation breakdown and refreshed loan balances. On `200` with `already_allocated=true`, treat the operation as successful and do not create another local row.

The backend performs one atomic operation:

```text
unclassified ClickPesa receipt
    → verified Payment created
    → penalty → fees → interest → principal allocated
    → loan outstanding and repayment schedule updated
    → system loan_repayment cashbook entry posted
    → original unclassified cashbook entry reversed/superseded
```

The frontend must refetch the affected datasets after success. Never also call `POST /payments`.

## Required synchronization

After any automatic payment, manual payment, webhook retry, or reconciliation refresh, invalidate/refetch:

- `GET /payments`;
- `GET /financial-entries`;
- affected loan detail;
- repayment schedule;
- ClickPesa webhook health when the user has permission.

Do not insert a speculative Cashbook row into local state. Refetch the backend result.

## Cashbook totals

Calculate or display totals from backend responses using only posted entries according to the existing API contract.

- `status=posted`: included.
- `status=reversed`: excluded.
- Never add the Payment amount separately to a Cashbook total; the system FinancialEntry already represents it.
- Never count both a reversed ClickPesa legacy entry and its replacement system entry.

## Filters

Provide useful filters:

- source: `system`, `clickpesa`, `manual`;
- category: `loan_repayment`, `registration_fee`, `unclassified_gateway_income`;
- status: `posted`, `reversed`;
- direction: `inflow`, `outflow` where supported;
- branch;
- date range.

Suggested saved views:

- **Automatic loan repayments**: `source=system`, `category=loan_repayment`, `status=posted`.
- **Automatic registration fees**: `source=system`, `category=registration_fee`, `status=posted`.
- **Needs investigation**: `source=clickpesa`, `category=unclassified_gateway_income`, `status=posted`.
- **Superseded legacy receipts**: `source=clickpesa`, `status=reversed`.

## Relationship to Payments

When a system Cashbook row contains `metadata.payment_id`, provide a **View payment** link if the user has payment-view permission.

The Payment page should show:

- customer;
- loan;
- amount;
- gateway reference;
- allocation breakdown;
- completed/verified status.

The Cashbook page should show the accounting entry. Do not duplicate the full repayment-editing workflow in Cashbook.

## Truly unmatched future receipts

Unknown or ambiguous `PAYMENT RECEIVED` transactions are posted as unclassified Cashbook inflows:

```text
source = clickpesa
category = unclassified_gateway_income
direction = inflow
status = posted
```

Display them as **Needs investigation** / **Unmatched**. Provide the existing Classify action for staff with `payments.create`. Classification does not credit a loan.

Do not manufacture a second Cashbook entry or Payment from the webhook event in frontend code.

Failed webhook events remain for payload/amount problems, not for an unknown BillPay number.

## Error handling

| Response | Frontend behavior |
| --- | --- |
| `401` | Refresh authentication or redirect to login |
| `403` | Hide unauthorized classification/audit actions |
| `404` | Refetch because the entry may have changed |
| `409` | Refetch; another operation may have resolved it |
| `422` | Display field-level validation messages |

## Acceptance criteria

1. Posted system loan repayments display the actual provider/channel as Method and a separate **Automatic** badge.
2. Posted system registration fees display the actual provider/channel as Method and a separate **Automatic** badge.
3. Automatically classified rows do not show manual classification actions.
4. Superseded legacy entries display as reversed and are excluded from posted totals.
5. Historical unclassified rows display as **Needs investigation**, not confirmed loan repayments.
6. Manual classification clearly states that it does not credit a loan.
7. Payment-linked system entries provide a View payment action when authorized.
8. Cashbook refreshes after payment, reconciliation, and webhook recovery actions.
9. Frontend never posts a second Cashbook entry for an automatic Payment.
10. Frontend never derives customer ownership from name, phone, or amount.
11. Posted totals never include both a legacy reversed entry and its replacement.
12. Truly unmatched future receipts appear in Cashbook as Needs investigation and can be classified as accounting income.
13. A verified unmatched receipt can be allocated to a selected loan through the dedicated endpoint.
14. The allocation confirmation displays the immutable ClickPesa amount/reference and requires verification notes.
15. Successful allocation refreshes loan balances, schedules, Payments, and Cashbook without calling `POST /payments`.

## Cursor AI prompt

```text
Implement the ClickPesa Cashbook UI exactly according to:
fronted-documentation/clickpesa-cashbook-auto-classification-frontend.md

Automatically classified system entries must display their actual provider/channel as the Method and a separate Automatic badge. Keep reversed legacy ClickPesa entries for audit but exclude them from posted totals. Show historical unclassified entries as Needs investigation. Add the global-admin Allocate to loan action using POST /financial-entries/{id}/allocate-to-loan, require branch/customer/loan/verification notes, show the immutable receipt details before confirmation, and refetch Payments, Cashbook, loan, and schedule data afterward. Never create a second Cashbook entry or separately call POST /payments. Add every acceptance test from the guide.
```
