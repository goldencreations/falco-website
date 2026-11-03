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
