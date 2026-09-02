import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapApplicationFormToFalcoBody,
  normalizeApplicationRepaymentFrequency,
} from "./application-payload";

describe("application repayment frequency", () => {
  it("preserves every supported API value, including bi_weekly", () => {
    assert.equal(normalizeApplicationRepaymentFrequency("daily"), "daily");
    assert.equal(normalizeApplicationRepaymentFrequency("weekly"), "weekly");
    assert.equal(normalizeApplicationRepaymentFrequency("bi_weekly"), "bi_weekly");
    assert.equal(normalizeApplicationRepaymentFrequency("monthly"), "monthly");
  });

  it("serializes the controlled monthly selection in create and update bodies", () => {
    const body = mapApplicationFormToFalcoBody({
      customer_id: "123",
      product_id: "4",
      loan_mode: "individual",
      requested_amount: 1_000_000,
      term_days: 180,
      repayment_frequency: "monthly",
      purpose: "Working capital",
      collaterals: [],
      guarantors: [],
      references: [],
    });

    assert.equal(body.repayment_frequency, "monthly");
  });
});
