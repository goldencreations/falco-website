import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { nextChartCode, matchingChartNodes, type ChartNode } from "./account-hierarchy";
import { CapitalTable, entryPayload } from "../components/general-ledger/general-ledger-register";
import { postingConfigurationIssue } from "./general-ledger-rule-setup";

const root: ChartNode = { id: 1, code: "1000", name: "Assets", type: "asset", parent_id: null, account_id: null };
const group: ChartNode = { id: 2, code: "1100", name: "Cash", type: "asset", parent_id: 1, account_id: null };
const leaf: ChartNode = { id: 3, code: "1101", name: "Cash on Hand", type: "asset", parent_id: 2, account_id: 1 };

describe("account numbering and search", () => {
  it("suggests hundred groups and numbered children without duplicates", () => {
    assert.equal(nextChartCode(root, [root, group, leaf]), "1200");
    assert.equal(nextChartCode(group, [root, group, leaf]), "1102");
    const full = Array.from({ length: 99 }, (_, index) => ({ ...leaf, id: index + 3, code: String(1101 + index) }));
    assert.equal(nextChartCode(group, full), null);
  });
  it("keeps matched account ancestors and gives an honest empty result", () => {
    assert.deepEqual(matchingChartNodes([root, group, leaf], "cash on hand").map(node => node.id), [1, 2, 3]);
    assert.deepEqual(matchingChartNodes([root, group, leaf], "missing"), []);
    assert.deepEqual(matchingChartNodes([root, group, leaf], ""), [root, group, leaf]);
  });
});

describe("rule-free capital", () => {
  it("sends decimal component strings without a rule or client-computed total", () => {
    const payload = entryPayload("capital", { transaction_date: "2026-10-20", cash_amount: "0.01", bank_amount: "99999999.99", payee: "Owner" });
    assert.equal(payload.cash_amount, "0.01");
    assert.equal(payload.bank_amount, "99999999.99");
    assert.equal("rule_id" in payload, false);
    assert.equal("amount" in payload, false);
    assert.equal(postingConfigurationIssue("capital", {}, undefined), null);
    assert.notEqual(postingConfigurationIssue("expenses", {}, undefined), null);
  });
  it("shows capital cash, bank and total rather than liability outstanding", () => {
    const markup = renderToStaticMarkup(createElement(CapitalTable, {
      rows: [{ id: 1, transaction_date: "2026-10-20", party_name: "Owner", amount: "300.03", outstanding_amount: "0.00", status: "posted", metadata: { capital_split: { cash_amount: "100.01", bank_amount: "200.02" } } }],
      onEdit: () => {}, onReverse: () => {},
    }));
    assert.match(markup, /Total capital/);
    assert.match(markup, /100.01/);
    assert.match(markup, /200.02/);
    assert.match(markup, /300.03/);
    assert.doesNotMatch(markup, /Outstanding|Liability/);
  });
});
