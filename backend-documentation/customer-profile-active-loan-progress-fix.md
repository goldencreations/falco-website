# Customer profile & active-loan repayment progress (truthful)

Frontend must never report a loan as `100% paid` while the backend still has an outstanding balance.

Use `lib/loan-repayment-truth.ts` → `resolveLoanRepaymentTruth()` on customer profile, loan list, loan detail, exports, and mobile layouts.

Progress = contractual paid ÷ contractual total (principal + interest + fees). **Exclude penalties from progress.**

A loan shows 100% only when `status === "paid_off"` **and** `total_outstanding <= 0.01`.

Regression: Mohamed Kwepu / `LN-APP-20260713-415351` → ~30.18% contractual progress, outstanding `TSh 188,095`, status In arrears, penalties charged/paid `234,000` / outstanding `0`.
