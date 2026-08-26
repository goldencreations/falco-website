import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInFlightRemaining,
  buildSelectableLoansFromApplications,
  type EligibleApplicationRow,
} from "./disbursement-eligible";
import { mergeEligibleLoanLists, type EligibleLoanRow } from "./disbursement-adapters";

const loan: EligibleLoanRow = {
  id: "42",
  loan_number: "LN-APP-20260824-261394",
  customer_id: "147",
  principal_amount: 619_500,
  remaining: 619_500,
};

const application: EligibleApplicationRow = {
  id: "47",
  application_number: "APP-20260824-261394",
  customer_display_name: "NAFTALI LUCAS OSWAGO",
  status: "pending_disbursement",
  approved_amount: 619_500,
  requested_amount: 619_500,
  loan_id: "42",
  loan_number: "LN-APP-20260824-261394",
  ready_for_disbursement: true,
};

test("a fully reserved payout is not reset to the original principal", () => {
  const rows = applyInFlightRemaining([loan], new Map([["42", 619_500]]));

  assert.deepEqual(rows, []);
});

test("reported and calculated remaining amounts are merged conservatively", () => {
  const rows = applyInFlightRemaining(
    [{ ...loan, remaining: 519_500 }],
    new Map([["42", 100_000]])
  );

  assert.equal(rows[0]?.remaining, 519_500);
  assert.equal(
    mergeEligibleLoanLists([{ ...loan, remaining: 619_500 }], rows)[0]?.remaining,
    519_500
  );
});

test("an application with a blocking disbursement is not rebuilt as eligible", () => {
  const rows = buildSelectableLoansFromApplications(
    [application],
    new Map(),
    new Set(["42"])
  );

  assert.deepEqual(rows, []);
});
