# Credit Analysis Controller

## Purpose

Credit Analysis supports analyst review for loan applications. It stores append-only analysis records, calculates cash-flow and ratio fields on the server, attaches analysis documents, updates customer risk profile outcomes, and exposes application context for analyst screens.

## Endpoints

All endpoints require bearer auth.

Branch scope: credit analysis endpoints are scoped through the loan application branch. Super admins may access all branches; branch-scoped analysts can only load, analyze, or attach files to applications in their assigned branch. Cross-branch application route models return `403 FORBIDDEN`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/credit-analysis/applications` | `credit_analysis.view` or `credit_analysis.create` | Paginated analysis queue |
| GET | `/credit-analysis/applications/{application}` | `credit_analysis.view` or `credit_analysis.create` | Load application, customer, product, and analysis history |
| POST | `/credit-analysis/applications/{application}/assign` | `credit_analysis.create` | Assign analyst |
| POST | `/credit-analysis/applications/{application}/analysis` | `credit_analysis.create` | Create an append-only analysis record |
| POST | `/credit-analysis/applications/{application}/attachments` | `credit_analysis.create` | Upload or register an analysis attachment |

## Inputs

`POST /credit-analysis/applications/{application}/analysis`:

```json
{
  "credit_score": 710,
  "risk_grade_recommendation": "A",
  "recommended_amount": 900000,
  "recommended_term_days": 90,
  "summary": "Business has strong repayment capacity.",
  "factors": [{ "key": "business_history", "value": "Trading for 4 years" }],
  "cash_flow": {
    "sales_revenue": 5000000,
    "purchases_cogs": 1800000,
    "business_expenses": 700000,
    "existing_monthly_debt_repayments": 300000,
    "household_expenses": 600000,
    "other_income": 200000
  },
  "loan_proposal": {
    "amount_requested": 1000000,
    "amount_approved": 900000,
    "loan_cycle": 2,
    "maturity_months": 3,
    "proposed_installment": 300000,
    "interest_rate_per_month": 6,
    "loan_purpose": "Working capital",
    "total_loans": 400000,
    "equity": 1000000,
    "inventory": 2000000,
    "current_assets": 3000000,
    "current_liabilities": 1500000
  },
  "risks": [{ "description": "Seasonal sales dip", "severity": "medium", "mitigation_plan": "Monitor weekly" }],
  "crb_details": {
    "source": "CRB",
    "score_status": "clear",
    "check_date": "2026-04-29",
    "remarks": "No adverse listing"
  },
  "committee_votes": [
    { "member_name": "Amina", "vote": "approve" },
    { "member_name": "Baraka", "vote": "approve" }
  ],
  "attachments": ["1"]
}
```

`POST /credit-analysis/applications/{application}/attachments` accepts multipart `file`, `type`, `name`, or JSON `url`, `type`, `name`.

## Outputs

Context endpoint:

```json
{
  "application": {},
  "customer": {},
  "product": {},
  "existing_analyses": []
}
```

Queue endpoint returns the shared paginated envelope and supports `status`, `branch_id`, and `assigned_analyst_id`.

Create analysis:

```json
{
  "analysis": {
    "id": "1",
    "application_id": "1",
    "analyst_id": "4",
    "credit_score": 710,
    "risk_grade_recommendation": "A",
    "recommended_amount": 900000,
    "cash_flow": {
      "gross_cash_flow": 5200000,
      "operating_net": 2700000,
      "disposable_income": 1800000,
      "repayment_capacity": 720000
    },
    "ratios": {
      "debt_service_ratio": 16.67,
      "leverage_ratio": 40,
      "rotation_ratio": 50,
      "liquidity_ratio": 200
    },
    "committee_decision": "approved",
    "attachments": []
  }
}
```

## Server Calculations

- `gross_cash_flow = sales_revenue + other_income`
- `operating_net = gross_cash_flow - purchases_cogs - business_expenses`
- `disposable_income = operating_net - existing_monthly_debt_repayments - household_expenses`
- `repayment_capacity = max(disposable_income, 0) * 40%`
- `debt_service_ratio = proposed_installment / disposable_income * 100`
- `leverage_ratio = total_loans / equity * 100`
- `rotation_ratio = amount_requested / inventory * 100`
- `liquidity_ratio = current_assets / current_liabilities * 100`

## Error Handling

- `422 VALIDATION_ERROR` for invalid nested data, out-of-bounds recommended amount or term, or missing attachment file/URL.
- `403 FORBIDDEN` when the user lacks credit-analysis permissions or attempts cross-branch access.
- `404 NOT_FOUND` when the application does not exist.

## Edge Cases

- Analysis records are append-only; creating another record adds history instead of editing the previous one.
- Committee decision is derived: any reject vote means `rejected`; all approve votes means `approved`; otherwise `pending`.
- Recommended amount and term must stay within the selected product limits.
- Uploaded attachments can be created before the analysis and linked by ID during analysis creation.
- Customer `risk_grade` and `credit_score` are updated when those recommendations are included.
- Analysis history and attachments are only exposed for applications inside the authenticated user's branch scope.

## Acceptance Criteria

- Analysts can see application context and prior analysis history before creating a new record.
- Server-calculated cash-flow and ratios are returned in the analysis response.
- Committee decision is derived from submitted votes.
- Mutations write audit logs.
