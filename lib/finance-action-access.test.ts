import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPostFinancialTransactions, FINANCE_ACTION_DENIED_MESSAGE } from "./finance-action-access";
import { canPrepareDisbursement, canApproveDisbursement } from "./disbursement-permissions";
import { paymentRecordedByLabel } from "./payment-method-display";
import { adaptPaymentViewRow } from "./payment-adapters";
import { adaptApiDisbursementRow } from "./disbursement-adapters";
import type { SessionUser } from "./auth";

describe("finance action access", () => {
  for (const role of ["branch_manager", "loan_officer", "credit_analyst", "collections_officer", "customer_service"]) {
    it(`denies ${role} despite stale or manually assigned permissions`, () => {
      const user = { role, permissions: ["all", "payments.create", "loans.disburse", "disbursements.prepare", "disbursements.approve"] } as Pick<SessionUser, "role" | "permissions">;
      assert.equal(canPostFinancialTransactions(user), false);
      assert.equal(canPrepareDisbursement(user), false);
      assert.equal(canApproveDisbursement(user), false);
    });
  }
  for (const role of ["super_admin", "accountant"]) {
    it(`allows ${role} to prepare and authorise disbursements`, () => {
      const user = { role, permissions: [] } as Pick<SessionUser, "role" | "permissions">;
      assert.equal(canPostFinancialTransactions(user), true);
      assert.equal(canPrepareDisbursement(user), true);
      assert.equal(canApproveDisbursement(user), true);
    });
  }
  it("denies unknown roles and unloaded sessions", () => {
    assert.equal(canPostFinancialTransactions(null), false);
    assert.equal(canPostFinancialTransactions({ role: "other" }), false);
    assert.equal(FINANCE_ACTION_DENIED_MESSAGE, "With this new update, this certain action is not allowed for you.");
  });
});

describe("recorded staff attribution", () => {
  it("keeps the named actor returned by the API without looking up a user directory", () => {
    const payment = adaptPaymentViewRow({ id: "1", received_by: "7", received_by_name: "Finance Officer", payment_method: "cash" });
    assert.equal(paymentRecordedByLabel(payment), "Finance Officer");
    assert.equal(payment.received_by, "7");
    const row = adaptApiDisbursementRow({ id: "1", prepared_by: "7", prepared_by_name: "Finance Officer", approved_by_name: "Authorising Officer", completed_by_name: "Completing Officer" });
    assert.equal(row.prepared_by_name, "Finance Officer");
    assert.equal(row.approved_by_name, "Authorising Officer");
    assert.equal(row.completed_by_name, "Completing Officer");
  });
  it("distinguishes automatic receipts from missing manual attribution", () => {
    assert.equal(paymentRecordedByLabel({ source: "clickpesa_webhook" }), "Automatic gateway");
    assert.equal(paymentRecordedByLabel({ payment_method: "cash" }), "Not recorded");
    assert.equal(paymentRecordedByLabel({ received_by_name: "  " }), "Not recorded");
  });
});
