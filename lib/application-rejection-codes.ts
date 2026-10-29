/**
 * Structured rejection codes for `POST /applications/{id}/review` (`decision: "reject"`).
 * The backend requires `rejection_code`; when the selected code is `other`,
 * `rejection_reason` becomes mandatory too. Values match the backend's
 * ReviewLoanApplicationRequest validation contract.
 */
export const APPLICATION_REJECTION_CODES: Array<{ value: string; label: string }> = [
  { value: "insufficient_income", label: "Insufficient income" },
  { value: "high_existing_debt", label: "High existing debt" },
  { value: "poor_credit_history", label: "Poor credit history" },
  { value: "insufficient_collateral", label: "Insufficient collateral" },
  { value: "incomplete_documentation", label: "Incomplete documentation" },
  { value: "policy_ineligible", label: "Outside lending policy / branch risk appetite" },
  { value: "fraud_risk", label: "Suspected fraud risk" },
  { value: "customer_withdrew", label: "Customer withdrew the request" },
  { value: "other", label: "Other (specify reason)" },
];

export function isKnownRejectionCode(value: string): boolean {
  return APPLICATION_REJECTION_CODES.some((c) => c.value === value);
}
