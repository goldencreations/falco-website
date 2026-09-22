import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptApiDisbursementRow } from "./disbursement-adapters";
import { canShowManualPayout } from "./disbursement-manual-payout";

describe("manual payout visibility", () => {
 it("shows the action only when the backend explicitly allows it", () => {
  assert.equal(canShowManualPayout({ can_record_manual_payout: true }), true);
  assert.equal(canShowManualPayout({ can_record_manual_payout: false }), false);
  assert.equal(canShowManualPayout({ can_record_manual_payout: undefined }), false);
 });

 it("maps the backend eligibility flag", () => {
  const row = adaptApiDisbursementRow({
   id: "41",
   loan_id: "9",
   status: "reversed",
   gateway: "clickpesa",
   can_record_manual_payout: true,
  });

  assert.equal(row.can_record_manual_payout, true);
 });
});
