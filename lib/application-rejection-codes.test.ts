import { strict as assert } from "node:assert";
import { test } from "node:test";
import { APPLICATION_REJECTION_CODES, isKnownRejectionCode } from "./application-rejection-codes";

test("every rejection choice is accepted by the review API contract", () => {
  const accepted = new Set([
    "insufficient_income", "high_existing_debt", "poor_credit_history",
    "insufficient_collateral", "incomplete_documentation", "policy_ineligible",
    "fraud_risk", "customer_withdrew", "other",
  ]);
  assert.equal(APPLICATION_REJECTION_CODES.length, accepted.size);
  for (const choice of APPLICATION_REJECTION_CODES) {
    assert.ok(accepted.delete(choice.value), `Unsupported or duplicate code: ${choice.value}`);
  }
  assert.equal(accepted.size, 0);
});

test("branch risk appetite uses the policy code instead of the rejected legacy code", () => {
  const choice = APPLICATION_REJECTION_CODES.find(choice => choice.label.includes("risk appetite"));
  assert.equal(choice?.value, "policy_ineligible");
  assert.equal(isKnownRejectionCode("policy_ineligible"), true);
  for (const invalid of ["above_risk_appetite", "failed_verification", "existing_default", "duplicate_application"]) {
    assert.equal(isKnownRejectionCode(invalid), false);
  }
});
