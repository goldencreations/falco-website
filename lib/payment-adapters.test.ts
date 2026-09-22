import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptPaymentViewRow } from "./payment-adapters";

describe("payment detail adapter", () => {
 it("keeps flat customer and reversal fields returned by the payment detail endpoint", () => {
  const payment = adaptPaymentViewRow({
   id: "42",
   payment_number: "PAY-00042",
   loan_id: "7",
   loan_number: "LN-00007",
   customer_id: "3",
   customer_name: "Asha Mteja",
   amount: 125000,
   principal_amount: 100000,
   interest_amount: 20000,
   fees_amount: 5000,
   penalty_amount: 0,
   status: "reversed",
   ledger_status: "reversed",
   payment_method: "mobile_money",
   reference_number: "CP-REFERENCE-42",
   payment_date: "2026-09-22",
   reversed_by: "1",
   reversed_at: "2026-09-22T09:30:00Z",
   reversal_reason: "Duplicate payment",
   reversal_of_payment_id: "41",
   updated_at: "2026-09-22T09:30:00Z",
  });

  assert.equal(payment.customer_display_name, "Asha Mteja");
  assert.equal(payment.loan_number, "LN-00007");
  assert.equal(payment.reversal_reason, "Duplicate payment");
  assert.equal(payment.reversed_by, "1");
  assert.equal(payment.reversal_of_payment_id, "41");
  assert.equal(payment.updated_at, "2026-09-22T09:30:00Z");
 });
});
