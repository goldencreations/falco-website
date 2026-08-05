/**
 * Structured rejection codes for `POST /applications/{id}/review` (`decision: "reject"`).
 * The backend requires `rejection_code`; when the selected code is `other`,
 * `rejection_reason` becomes mandatory too. Exact enum values are not published in the
 * Swagger-derived docs bundled with this repo, so this list follows the one documented
 * example (`insufficient_income`) plus the standard set of underwriting decline reasons.
 */
export const APPLICATION_REJECTION_CODES: Array<{ value: string; label: string }> = [
  { value: "insufficient_income", label: "Insufficient income" },
  { value: "poor_credit_history", label: "Poor credit history" },
  { value: "insufficient_collateral", label: "Insufficient collateral" },
  { value: "incomplete_documentation", label: "Incomplete documentation" },
  { value: "failed_verification", label: "Failed identity/KYC verification" },
  { value: "existing_default", label: "Existing loan default or arrears" },
  { value: "duplicate_application", label: "Duplicate application" },
  { value: "customer_withdrew", label: "Customer withdrew the request" },
  { value: "above_risk_appetite", label: "Above branch risk appetite" },
  { value: "other", label: "Other (specify reason)" },
];

export function isKnownRejectionCode(value: string): boolean {
  return APPLICATION_REJECTION_CODES.some((c) => c.value === value);
}
