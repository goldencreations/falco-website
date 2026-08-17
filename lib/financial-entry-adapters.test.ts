import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptApiFinancialEntryRow,
  financialEntryDisplayLabel,
  financialEntryIsUnmatchedClickPesa,
  financialEntryMethodLabel,
  financialEntryNeedsClassification,
  financialEntryOrderReference,
  financialEntryPayerHint,
  financialEntrySourceBadgeLabel,
  mapUiFinancialEntryClassificationToApi,
} from "./financial-entry-adapters";

const unmatchedExample = {
  id: "103",
  entry_number: "FIN-20260817-801E27",
  branch_id: null,
  customer_id: null,
  entry_type: "other_income",
  direction: "inflow",
  category: "unclassified_gateway_income",
  amount: 66528,
  transaction_date: "2026-08-17",
  payment_method: "gateway",
  reference_number: "MP260817.1123.Q86853",
  account_name: "Seja Habibu Mohamed",
  description: "Unmatched ClickPesa receipt awaiting classification. Order reference 35218598.",
  status: "posted",
  source: "clickpesa",
  metadata: {
    gateway: "clickpesa",
    source: "clickpesa_webhook",
    classification: "unclassified_gateway_income",
    unmatched: true,
    gateway_payment_reference: "MP260817.1123.Q86853",
    order_reference: "35218598",
    channel: "AIRTEL BILLPAY",
    gateway_customer_name: "Seja Habibu Mohamed",
    gateway_customer_phone: "255700000001",
  },
};

describe("clickpesa cashbook unmatched receipts", () => {
  it("renders unmatched posted clickpesa income as needs investigation", () => {
    const row = adaptApiFinancialEntryRow(unmatchedExample);
    assert.equal(row.source, "clickpesa");
    assert.equal(row.category, "unclassified_gateway_income");
    assert.equal(row.direction, "in");
    assert.equal(row.reference, "MP260817.1123.Q86853");
    assert.equal(row.customer_id, undefined);
    assert.equal(row.customer_name, undefined);
    assert.equal(financialEntryDisplayLabel(row), "Needs investigation");
    assert.equal(financialEntrySourceBadgeLabel(row), "ClickPesa unmatched");
    assert.equal(financialEntryMethodLabel(row), "Seja Habibu Mohamed");
    assert.equal(financialEntryOrderReference(row), "35218598");
    assert.deepEqual(financialEntryPayerHint(row), {
      name: "Seja Habibu Mohamed",
      phone: "255700000001",
    });
    assert.equal(financialEntryNeedsClassification(row), true);
    assert.equal(financialEntryIsUnmatchedClickPesa(row), true);
  });

  it("does not treat gateway payer name as a Falco customer", () => {
    const row = adaptApiFinancialEntryRow({
      ...unmatchedExample,
      customer_name: "Seja Habibu Mohamed",
    });
    assert.equal(row.customer_name, undefined);
  });

  it("hides classify after metadata.classification is classified", () => {
    const row = adaptApiFinancialEntryRow({
      ...unmatchedExample,
      metadata: { ...unmatchedExample.metadata, classification: "classified", unmatched: false },
      category: "application_fee",
    });
    assert.equal(financialEntryNeedsClassification(row), false);
  });

  it("uses channel as method when account_name is missing", () => {
    const row = adaptApiFinancialEntryRow({
      ...unmatchedExample,
      account_name: "",
      payment_method: "gateway",
    });
    assert.equal(financialEntryMethodLabel(row), "AIRTEL BILLPAY");
  });

  it("never labels unmatched method as Gateway (Auto)", () => {
    const row = adaptApiFinancialEntryRow({
      ...unmatchedExample,
      account_name: "",
      payment_method: "Gateway (Auto)",
      metadata: { ...unmatchedExample.metadata, channel: "" },
    });
    assert.equal(financialEntryMethodLabel(row), "ClickPesa");
    assert.notEqual(financialEntryDisplayLabel(row), "Payment failed");
    assert.notEqual(financialEntryDisplayLabel(row), "Loan repayment");
  });

  it("excludes reversed unmatched rows from the classify queue", () => {
    const row = adaptApiFinancialEntryRow({
      ...unmatchedExample,
      status: "reversed",
      is_reversed: true,
    });
    assert.equal(financialEntryNeedsClassification(row), false);
    assert.equal(financialEntryIsUnmatchedClickPesa(row), false);
  });
});

describe("clickpesa classification payload", () => {
  it("sends classification fields without amount, direction, or a new payment", () => {
    const payload = mapUiFinancialEntryClassificationToApi({
      branch_id: "branch-dar01",
      customer_id: 28,
      entry_type: "other_income",
      category: "application_fee",
      description: "ClickPesa unmatched receipt classified after review",
      classification_notes: "Confirmed against ClickPesa receipt MP260817.1123.Q86853",
    });
    assert.equal(payload.branch_id, "branch-dar01");
    assert.equal(payload.customer_id, 28);
    assert.equal(payload.entry_type, "other_income");
    assert.equal(payload.category, "application_fee");
    assert.equal(payload.classification_notes, "Confirmed against ClickPesa receipt MP260817.1123.Q86853");
    assert.equal(payload.amount, undefined);
    assert.equal(payload.direction, undefined);
    assert.equal(payload.reference_number, undefined);
    assert.equal(payload.source, undefined);
  });
});

describe("clickpesa cashbook auto-classification labels", () => {
  it("labels system gateway loan repayments without Gateway (Auto)", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "system",
      category: "loan_repayment",
      direction: "inflow",
      status: "posted",
      payment_method: "gateway",
      account_name: "TIGO-PESA",
      metadata: { payment_id: "p1" },
    });
    assert.equal(financialEntryDisplayLabel(row), "Loan repayment");
    assert.equal(financialEntrySourceBadgeLabel(row), "Automatic");
    assert.equal(financialEntryMethodLabel(row), "TIGO-PESA");
    assert.equal(financialEntryNeedsClassification(row), false);
  });

  it("labels system gateway registration fees as automatic", () => {
    const row = adaptApiFinancialEntryRow({
      id: "1",
      source: "system",
      category: "registration_fee",
      direction: "inflow",
      status: "posted",
      payment_method: "gateway",
    });
    assert.equal(financialEntryDisplayLabel(row), "Registration fee");
    assert.equal(financialEntrySourceBadgeLabel(row), "Automatic");
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
});
