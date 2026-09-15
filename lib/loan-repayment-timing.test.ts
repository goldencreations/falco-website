import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptApiLoanRow } from "./loan-adapters";

describe("loan repayment timing", () => {
  it("keeps maturity separate from the oldest overdue installment", () => {
    const loan = adaptApiLoanRow({
      id: 21,
      loan_number: "LN-APP-20260805-498529",
      status: "in_arrears",
      maturity_date: "2026-10-28",
      oldest_overdue_date: "2026-08-12",
      overdue_amount: "179951.36",
      next_due_date: "2026-09-09",
      next_due_amount: "59908.34",
    });

    assert.equal(loan.maturity_date, "2026-10-28");
    assert.equal(loan.oldest_overdue_date, "2026-08-12");
    assert.equal(loan.overdue_amount, 179951.36);
    assert.equal(loan.next_due_date, "2026-09-09");
    assert.equal(loan.next_due_amount, 59908.34);
    assert.notEqual(loan.oldest_overdue_date, loan.maturity_date);
  });

  it("does not invent an overdue date from maturity", () => {
    const loan = adaptApiLoanRow({
      id: 32,
      loan_number: "LN-APP-20260814-155964",
      status: "active",
      maturity_date: "2026-11-06",
      next_due_date: "2026-09-11",
      next_due_amount: 71890,
    });

    assert.equal(loan.oldest_overdue_date, undefined);
    assert.equal(loan.maturity_date, "2026-11-06");
    assert.equal(loan.next_due_date, "2026-09-11");
  });
});
