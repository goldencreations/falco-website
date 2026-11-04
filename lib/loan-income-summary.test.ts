import { strict as assert } from "node:assert";
import { test } from "node:test";
import { eatIncomeDates, loanIncomeSummaryUrl } from "./loan-income-summary";

test("income defaults use the EAT date across UTC midnight and month boundaries", () => {
  assert.deepEqual(eatIncomeDates(new Date("2026-10-31T22:00:00Z")), { from: "2026-11-01", to: "2026-11-01" });
  assert.deepEqual(eatIncomeDates(new Date("2026-12-31T21:00:00Z")), { from: "2027-01-01", to: "2027-01-01" });
});
test("income URLs preserve calendar strings and omit from for all-time requests", () => {
  assert.equal(loanIncomeSummaryUrl("2026-10-01", "2026-10-31", false), "/api/general-ledger/income/loan-summary?from=2026-10-01&to=2026-10-31");
  assert.equal(loanIncomeSummaryUrl("2026-10-01", "2026-10-31", true), "/api/general-ledger/income/loan-summary?all_time=1&to=2026-10-31");
});


test("review links open the affected loan or customer without inventing missing records", async () => {
  const { loanIncomeReviewHref } = await import("./loan-income-summary");
  const record = { event_id: 729, payment_number: "PAY-81", loan_id: 17, loan_number: "LN-17", customer_id: 29 };
  assert.equal(loanIncomeReviewHref(record), "/loans/17");
  assert.equal(loanIncomeReviewHref({ ...record, loan_id: null }), "/customers/29");
  assert.equal(loanIncomeReviewHref({ ...record, loan_id: null, customer_id: null }), null);
  assert.equal(loanIncomeReviewHref({ ...record, loan_id: -1, customer_id: null }), null);
});
