import assert from "node:assert/strict";
import { test } from "node:test";
import { moneyAccount, transactionFieldVisible, applyAccountDefaults } from "./general-ledger-transaction-accounts";
import { compatibleAccountPurposes, chartAccountReadiness, type ChartNode, type AccountPurpose } from "./account-hierarchy";
import { entryPayload, resolvedField } from "../components/general-ledger/general-ledger-register";

test("money choices contain operational cash/bank accounts and new money accounts, not receivables or review-only accounts", () => {
  assert.equal(moneyAccount({ code: "1020", type: "asset" }), true);
  assert.equal(moneyAccount({ code: "COA-1201", type: "asset", report_category: "bs.cash.bank.non_agent" }), true);
  assert.equal(moneyAccount({ code: "COA-1202", type: "asset", report_category: "bs.ppe.cost" }), false);
  assert.equal(moneyAccount({ code: "1100", type: "asset" }), false);
  assert.equal(moneyAccount({ code: "COA-1203", type: "asset", report_category: "bs.cash.hand", metadata: { guided_setup: { mode: "review" } } }), false);
});

test("transaction controls ask for money only where needed and allow grant treatment at transaction time", () => {
  assert.equal(transactionFieldVisible("assets", "settlement_account_id", { acquisition_type: "granted" }), false);
  assert.equal(transactionFieldVisible("assets", "grant_counterpart_account_id", { acquisition_type: "granted" }), true);
  assert.equal(transactionFieldVisible("expenses", "settlement_account_id", { settlement_status: "unpaid" }), false);
  assert.equal(transactionFieldVisible("income", "settlement_account_id", {}), true);
  assert.equal(transactionFieldVisible("capital", "bank_account_id", { bank_amount: "0" }), false);
  assert.equal(transactionFieldVisible("capital", "bank_account_id", { bank_amount: "10.01" }), true);
});

test("selecting a guided account applies asset/liability classifications without guessing amounts or settlements", () => {
  assert.deepEqual(applyAccountDefaults({ amount: "12.34", rule_id: "4" }, { defaults: { guided_chart_node_id: 4, liability_kind: "borrowed" } }), { amount: "12.34", rule_id: "4", liability_type: "borrowed" });
  assert.equal(applyAccountDefaults({}, { defaults: { asset_class: "current" } }).asset_type, "current");
});

test("payloads preserve transaction-specific grant, bank and capital account choices", () => {
  const asset = entryPayload("assets", { rule_id: "7", acquisition_type: "granted", grant_counterpart_account_id: "21", asset_type: "fixed", value: "50.10" });
  assert.equal(asset.grant_counterpart_account_id, 21);
  const income = entryPayload("income", { rule_id: "8", settlement_account_id: "22", amount: "100.99" });
  assert.equal(income.settlement_account_id, 22);
  const capital = entryPayload("capital", { cash_amount: "0", bank_amount: "12.25", bank_account_id: "22", capital_account_id: "23" });
  assert.equal(capital.bank_account_id, 22);
  assert.equal(capital.capital_account_id, 23);
  assert.equal("rule_id" in capital, false);
});

test("purpose options stay in their account type and readiness distinguishes setup, review and usable accounts", () => {
  const purpose = { value: "bs.ppe.cost", account_types: ["asset"] } as AccountPurpose;
  assert.deepEqual(compatibleAccountPurposes([purpose], "expense"), []);
  assert.deepEqual(compatibleAccountPurposes([purpose], "asset"), [purpose]);
  const node = { id: 2, code: "1201", type: "asset", name: "Equipment", parent_id: 1, account_id: 2, posting_rule_ready: true, account: { code: "COA-1201", is_active: true, is_postable: true, normal_balance: "debit", report_category: "bs.ppe.cost" } } satisfies ChartNode;
  assert.equal(chartAccountReadiness(node), "Ready to record");
  assert.equal(chartAccountReadiness({ ...node, posting_rule_ready: false }), "Needs setup");
  assert.equal(chartAccountReadiness({ ...node, account: { ...node.account, metadata: { guided_setup: { mode: "review", register: "asset", help: "Needs review" } } } }), "Needs accounting review");
});

test("related payable choices use expenses/assets while money receipts exclude them", () => {
  const account = { id: 12, code: "COA-5201", name: "Office costs", type: "expense", report_category: "is.noninterest_expense.other" };
  const options = { accounts: [account, { id: 3, code: "1020", name: "Bank", type: "asset" }], rules: [] };
  const field = { name: "settlement_account_id", label: "Account" };
  assert.equal(resolvedField(field, "liabilities", options, { liability_type: "payable" }).options?.[0].value, "12");
  assert.equal(resolvedField(field, "income", options, {}).options?.[0].value, "3");
});
