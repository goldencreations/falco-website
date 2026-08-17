import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptApiFinancialEntryRow,
  exactActiveGroupMatch,
  extractAllocateToGroupResult,
  extractAllocateToLoanResult,
  financialEntryDisplayLabel,
  financialEntryIsUnmatchedClickPesa,
  financialEntryMethodLabel,
  financialEntryNeedsClassification,
  financialEntryOrderReference,
  financialEntryPayerHint,
  financialEntrySourceBadgeLabel,
  hasExactActiveGroupMatch,
  mapUiFinancialEntryAllocateToGroupToApi,
  mapUiFinancialEntryAllocateToLoanToApi,
  mapUiFinancialEntryClassificationToApi,
  normalizeClickPesaPayerName,
  splitReceiptAcrossOutstanding,
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
    assert.equal(financialEntryMethodLabel(row), "AIRTEL BILLPAY");
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

  it("does not display the payer or group name as the payment provider", () => {
    const row = adaptApiFinancialEntryRow({
      ...unmatchedExample,
      account_name: "UAMINIFU GROUP",
      metadata: {
        ...unmatchedExample.metadata,
        channel: "AIRTEL BILLPAY",
        gateway_customer_name: "UAMINIFU GROUP",
      },
    });
    assert.equal(financialEntryMethodLabel(row), "AIRTEL BILLPAY");
    assert.equal(financialEntryPayerHint(row).name, "UAMINIFU GROUP");
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

describe("clickpesa allocate-to-loan payload", () => {
  it("sends branch, customer, loan, and notes without amount", () => {
    const payload = mapUiFinancialEntryAllocateToLoanToApi({
      branch_id: "branch-dom01",
      customer_id: 33,
      loan_id: 21,
      notes: "Verified against the ClickPesa merchant receipt",
      amount: 66528,
      direction: "inflow",
      reference_number: "MP260817.1123.Q86853",
    });
    assert.equal(payload.branch_id, "branch-dom01");
    assert.equal(payload.customer_id, 33);
    assert.equal(payload.loan_id, 21);
    assert.equal(payload.notes, "Verified against the ClickPesa merchant receipt");
    assert.equal(payload.amount, undefined);
    assert.equal(payload.direction, undefined);
    assert.equal(payload.reference_number, undefined);
    assert.equal(payload.source, undefined);
  });

  it("reads allocation breakdown and already_allocated from the API body", () => {
    const result = extractAllocateToLoanResult({
      already_allocated: false,
      payment: {
        id: "44",
        amount: 66528,
        penalty_allocated: 2000,
        fees_allocated: 0,
        interest_allocated: 14528,
        principal_allocated: 50000,
      },
      loan: {
        id: "21",
        total_outstanding: 100000,
        total_paid: 66528,
        penalty_outstanding: 0,
      },
    });
    assert.equal(result.already_allocated, false);
    assert.equal(result.payment_id, "44");
    assert.equal(result.loan_id, "21");
    assert.equal(result.penalty_allocated, 2000);
    assert.equal(result.principal_allocated, 50000);
    assert.equal(result.loan_penalty_outstanding, 0);
    assert.equal(result.loan_total_paid, 66528);
  });

  it("treats already_allocated as success without inventing a second row", () => {
    const result = extractAllocateToLoanResult({ already_allocated: true, payment_id: "44" });
    assert.equal(result.already_allocated, true);
    assert.equal(result.payment_id, "44");
  });
});

describe("clickpesa allocate-to-group payload", () => {
  it("sends branch, group, notes, and allocation rows without a top-level amount", () => {
    const payload = mapUiFinancialEntryAllocateToGroupToApi({
      branch_id: "branch-dom01",
      group_id: 12,
      notes: "Verified against the ClickPesa merchant receipt",
      amount: 66528,
      allocation: [
        { loan_id: 81, customer_id: 33, amount: 20000 },
        { loan_id: 82, customer_id: 34, amount: 46528 },
      ],
      direction: "inflow",
    });
    assert.equal(payload.branch_id, "branch-dom01");
    assert.equal(payload.group_id, 12);
    assert.equal(payload.notes, "Verified against the ClickPesa merchant receipt");
    assert.deepEqual(payload.allocations, [
      { loan_id: 81, customer_id: 33, amount: 20000 },
      { loan_id: 82, customer_id: 34, amount: 46528 },
    ]);
    assert.equal(payload.amount, undefined);
    assert.equal(payload.allocation, undefined);
    assert.equal(payload.customer_id, undefined);
    assert.equal(payload.loan_id, undefined);
  });

  it("drops zero-amount allocation rows", () => {
    const payload = mapUiFinancialEntryAllocateToGroupToApi({
      branch_id: "branch-dom01",
      group_id: 12,
      notes: "Verified",
      allocation: [
        { loan_id: 81, customer_id: 33, amount: 66528 },
        { loan_id: 82, customer_id: 34, amount: 0 },
      ],
    });
    assert.deepEqual(payload.allocations, [{ loan_id: 81, customer_id: 33, amount: 66528 }]);
  });

  it("splits a receipt across outstanding balances without exceeding any loan", () => {
    const rows = splitReceiptAcrossOutstanding(66528, [
      { loan_id: "81", outstanding: 50000 },
      { loan_id: "82", outstanding: 20000 },
    ]);
    assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 66528);
    assert.equal(rows.find((row) => row.loan_id === "81")?.amount, 47520);
    assert.equal(rows.find((row) => row.loan_id === "82")?.amount, 19008);
  });

  it("sums member allocation rows when the API returns them", () => {
    const result = extractAllocateToGroupResult({
      already_allocated: false,
      group_id: 12,
      allocations: [
        { payment_id: "44", loan_id: 81, penalty_allocated: 1000, principal_allocated: 20000 },
        { payment_id: "45", loan_id: 82, penalty_allocated: 500, principal_allocated: 45028 },
      ],
    });
    assert.equal(result.already_allocated, false);
    assert.equal(result.group_id, "12");
    assert.equal(result.penalty_allocated, 1500);
    assert.equal(result.principal_allocated, 65028);
  });
});

describe("clickpesa group name suggestion", () => {
  const groups = [
    { id: "12", group_name: "Uaminifu Group", group_code: "GRP-12", status: "active", branch_id: "branch-dom01" },
    { id: "13", group_name: "Tumaini Group", group_code: "GRP-13", status: "active", branch_id: "branch-dom01" },
    { id: "14", group_name: "Old Group", group_code: "GRP-14", status: "inactive", branch_id: "branch-dom01" },
  ];

  it("normalizes whitespace and case for exact matching", () => {
    assert.equal(normalizeClickPesaPayerName("  uaminifu   group "), "UAMINIFU GROUP");
  });

  it("suggests a unique active group that exactly matches the payer name", () => {
    const match = exactActiveGroupMatch(groups, "UAMINIFU GROUP");
    assert.equal(match?.id, "12");
    assert.equal(hasExactActiveGroupMatch(groups, "UAMINIFU GROUP"), true);
  });

  it("does not treat a payer that merely resembles a group name as a match", () => {
    assert.equal(exactActiveGroupMatch(groups, "SEJA HABIBU MOHAMED"), undefined);
    assert.equal(hasExactActiveGroupMatch(groups, "SOME OTHER GROUP"), false);
    assert.equal(exactActiveGroupMatch(groups, "Old Group"), undefined);
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
