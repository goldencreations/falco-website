import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptApiFinancialEntryRow,
  financialEntryDisplayLabel,
  financialEntryNeedsClassification,
} from "./financial-entry-adapters";

describe("clickpesa cashbook auto-classification labels", () => {
  it("labels system gateway loan repayments as auto", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "system",
      category: "loan_repayment",
      direction: "inflow",
      status: "posted",
      payment_method: "gateway",
    });
    assert.equal(financialEntryDisplayLabel(row), "Loan repayment · Gateway (Auto)");
  });

  it("labels system gateway registration fees as auto", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "system",
      category: "registration_fee",
      direction: "inflow",
      status: "posted",
      payment_method: "gateway",
    });
    assert.equal(financialEntryDisplayLabel(row), "Registration fee · Gateway (Auto)");
  });

  it("labels superseded legacy clickpesa entries correctly", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "clickpesa",
      category: "unclassified_gateway_income",
      direction: "inflow",
      status: "reversed",
      reversal_reason: "Superseded by an automatically allocated ClickPesa payment.",
    });
    assert.equal(financialEntryDisplayLabel(row), "Superseded by automatic payment");
    assert.equal(financialEntryNeedsClassification(row), false);
  });

  it("labels posted historical unclassified rows as needs investigation", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "clickpesa",
      category: "unclassified_gateway_income",
      direction: "inflow",
      status: "posted",
    });
    assert.equal(financialEntryDisplayLabel(row), "Needs investigation");
    assert.equal(financialEntryNeedsClassification(row), true);
  });
});

describe("classification safeguards", () => {
  it("does not auto-convert unclassified clickpesa rows to loan repayment based on customer fields", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "clickpesa",
      category: "unclassified_gateway_income",
      direction: "inflow",
      status: "posted",
      customer_id: "33",
      customer_name: "Asha Adam Juma",
    });
    assert.equal(row.category, "unclassified_gateway_income");
    assert.equal(financialEntryDisplayLabel(row), "Needs investigation");
  });
});

