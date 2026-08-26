import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveLoanRepaymentTruth,
  resolveLoanDisplayStatus,
  summarizeCustomerPaymentAllocations,
  summarizeCustomerLoanTruth,
  resolveScheduleInstallmentTruth,
  isSettledPayment,
} from "./loan-repayment-truth";

/** Mohamed Kwepu / LN-APP-20260713-415351 production regression. */
const mohamedLoan = {
  id: "loan-mohamed",
  loan_number: "LN-APP-20260713-415351",
  principal: 200000,
  principal_amount: 200000,
  total_repayment: 269410,
  penalty_amount: 234000,
  principal_outstanding: 185065,
  interest_outstanding: 3030,
  fees_outstanding: 0,
  penalty_outstanding: 0,
  total_outstanding: 188095,
  status: "in_arrears",
  days_in_arrears: 37,
  principal_paid: 14935,
  interest_paid: 22380,
  fees_paid: 44000,
};

const mohamedPayments = [
  {
    id: "p1",
    amount: 315315,
    principal_amount: 14935,
    interest_amount: 22380,
    fees_amount: 44000,
    penalty_amount: 234000,
    status: "completed",
  },
];

describe("resolveLoanRepaymentTruth — Mohamed Kwepu regression", () => {
  it("does not display 100% paid while outstanding remains", () => {
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.ok(truth.contractualProgress < 100);
    assert.notEqual(truth.contractualProgress, 100);
    assert.equal(truth.isPaidOff, false);
  });

  it("shows approximately 30.18% contractual progress", () => {
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.ok(Math.abs(truth.contractualProgress - 30.18) < 0.02);
  });

  it("shows total outstanding of 188095", () => {
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.equal(truth.totalOutstanding, 188095);
  });

  it("keeps status as In arrears", () => {
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.equal(truth.displayStatus, "In arrears");
    assert.equal(truth.daysInArrears, 37);
  });

  it("shows penalties charged/paid/outstanding correctly", () => {
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.equal(truth.penaltiesCharged, 234000);
    assert.equal(truth.penaltiesPaid, 234000);
    assert.equal(truth.penaltyOutstanding, 0);
  });

  it("separates gross cash from money applied to the contract", () => {
    const payments = summarizeCustomerPaymentAllocations(mohamedPayments);
    assert.equal(payments.cashReceived, 315315);
    assert.equal(payments.appliedToContract, 14935 + 22380 + 44000);
    assert.equal(payments.penaltiesPaid, 234000);
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.ok(payments.cashReceived > truth.contractualPaid);
  });

  it("never marks the loan completed from gross payments alone", () => {
    const truth = resolveLoanRepaymentTruth({
      ...mohamedLoan,
      // Simulate UI that only saw large payments — loan fields still in arrears.
    });
    assert.equal(truth.isPaidOff, false);
    assert.ok(truth.contractualProgress < 100);
  });
});

describe("resolveLoanRepaymentTruth — general cases", () => {
  it("shows 100% only when paid_off and outstanding is zero", () => {
    const truth = resolveLoanRepaymentTruth({
      principal_amount: 100000,
      total_repayment: 120000,
      principal_outstanding: 0,
      interest_outstanding: 0,
      fees_outstanding: 0,
      penalty_amount: 5000,
      penalty_outstanding: 0,
      total_outstanding: 0,
      status: "paid_off",
    });
    assert.equal(truth.isPaidOff, true);
    assert.equal(truth.contractualProgress, 100);
    assert.equal(truth.displayStatus, "Paid off");
  });

  it("flags inconsistent paid_off with outstanding as data requires review", () => {
    const status = resolveLoanDisplayStatus({
      status: "paid_off",
      total_outstanding: 5000,
    });
    assert.equal(status.label, "Data requires review");
    assert.equal(status.dataRequiresReview, true);
    assert.equal(status.isPaidOff, false);
  });

  it("handles partial repayment without penalties", () => {
    const truth = resolveLoanRepaymentTruth({
      principal_amount: 100000,
      total_repayment: 110000,
      principal_outstanding: 50000,
      interest_outstanding: 5000,
      fees_outstanding: 0,
      penalty_amount: 0,
      penalty_outstanding: 0,
      total_outstanding: 55000,
      status: "active",
    });
    assert.equal(truth.contractualPaid, 55000);
    assert.equal(truth.contractualProgress, 50);
    assert.equal(truth.displayStatus, "Active");
  });

  it("handles penalties greater than contractual payments", () => {
    const truth = resolveLoanRepaymentTruth(mohamedLoan);
    assert.ok(truth.penaltiesCharged > truth.contractualPaid);
    assert.ok(truth.contractualProgress < 50);
  });

  it("excludes reversed payments from cash and allocation totals", () => {
    const summary = summarizeCustomerPaymentAllocations([
      {
        amount: 10000,
        principal_amount: 8000,
        interest_amount: 2000,
        fees_amount: 0,
        penalty_amount: 0,
        status: "completed",
      },
      {
        amount: 50000,
        principal_amount: 10000,
        interest_amount: 0,
        fees_amount: 0,
        penalty_amount: 40000,
        status: "reversed",
      },
    ]);
    assert.equal(summary.cashReceived, 10000);
    assert.equal(summary.appliedToContract, 10000);
    assert.equal(summary.penaltiesPaid, 0);
  });

  it("marks payments unavailable when payment list is null", () => {
    const summary = summarizeCustomerPaymentAllocations(null);
    assert.equal(summary.paymentsUnavailable, true);
  });

  it("treats missing contractual total safely without inventing 100%", () => {
    const truth = resolveLoanRepaymentTruth({
      principal_amount: 100000,
      principal_outstanding: 100000,
      interest_outstanding: 0,
      fees_outstanding: 0,
      total_outstanding: 100000,
      status: "active",
    });
    // Falls back to total_amount which may be 0 if absent — progress stays 0.
    assert.ok(truth.contractualProgress < 100);
    assert.equal(truth.isPaidOff, false);
  });

  it("aggregates customer loan truth for completed count", () => {
    const summary = summarizeCustomerLoanTruth([
      mohamedLoan,
      {
        principal_amount: 50000,
        total_repayment: 55000,
        principal_outstanding: 0,
        interest_outstanding: 0,
        fees_outstanding: 0,
        penalty_outstanding: 0,
        total_outstanding: 0,
        status: "paid_off",
      },
    ]);
    assert.equal(summary.completedLoans, 1);
    assert.equal(summary.totalOutstanding, 188095);
    assert.equal(summary.penaltiesCharged, 234000);
  });
});

describe("isSettledPayment", () => {
  it("rejects reversed and pending", () => {
    assert.equal(isSettledPayment({ status: "reversed" }), false);
    assert.equal(isSettledPayment({ status: "pending" }), false);
    assert.equal(isSettledPayment({ status: "completed" }), true);
  });
});

describe("resolveScheduleInstallmentTruth", () => {
  it("keeps contractual installment separate from penalties", () => {
    const row = resolveScheduleInstallmentTruth({
      principal_due: 10000,
      interest_due: 2000,
      fees_due: 0,
      total_due: 12000,
      principal_paid: 5000,
      interest_paid: 2000,
      fees_paid: 0,
      penalty_due: 3000,
      penalty_paid: 3000,
      penalty_outstanding: 0,
      balance_due: 5000,
    });
    assert.equal(row.contractualInstallment, 12000);
    assert.equal(row.contractualPaid, 7000);
    assert.equal(row.contractualOutstanding, 5000);
    assert.equal(row.penaltyCharged, 3000);
    assert.equal(row.penaltyPaid, 3000);
    assert.equal(row.penaltyOutstanding, 0);
    // Paid penalties must not inflate contractual progress.
    assert.ok(row.contractualPaid < row.contractualInstallment);
  });
});
