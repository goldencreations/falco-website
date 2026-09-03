import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEditApplicationLoanDetails } from "./application-workflow";

describe("canEditApplicationLoanDetails", () => {
  it("allows editing before an application creates a loan", () => {
    for (const status of ["draft", "submitted", "under_review", "approved"] as const) {
      assert.equal(canEditApplicationLoanDetails({ status }), true);
    }
  });

  it("blocks editing once a loan exists or the application is terminal", () => {
    assert.equal(canEditApplicationLoanDetails({ status: "approved", loan_id: "91" }), false);
    assert.equal(canEditApplicationLoanDetails({ status: "pending_disbursement" }), false);
    assert.equal(canEditApplicationLoanDetails({ status: "disbursed" }), false);
    assert.equal(canEditApplicationLoanDetails({ status: "rejected" }), false);
    assert.equal(canEditApplicationLoanDetails({ status: "cancelled" }), false);
  });
});
