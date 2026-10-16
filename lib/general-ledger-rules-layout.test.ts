import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { FormField, resolvedField, RulesList } from "../components/general-ledger/general-ledger-register";

const actions = { onEdit: () => {}, onArchive: async () => {} };

describe("compact Rules groups", () => {
  it("constrains posting dropdowns and wraps labels instead of expanding the form", () => {
    const markup = renderToStaticMarkup(createElement(FormField, {
      field: { name: "payable_account_id", label: "Accounts payable when unpaid (Credit)", type: "select", required: true, options: [{ value: "1", label: "2100 — Accounts Payable with a long account name" }] },
      value: "",
      compact: true,
      onChange: () => {},
    }));
    assert.match(markup, /class="min-w-0 /);
    assert.match(markup, /block leading-snug \[overflow-wrap:anywhere\]/);
    assert.match(markup, /w-full min-w-0 max-w-full text-left/);
    assert.match(markup, /\[&amp;_\[data-slot=select-value\]\]:truncate/);
    assert.match(markup, /id="gl-payable_account_id"/);
    assert.match(markup, /Select accounts payable when unpaid/);
  });

  it("keeps existing rules, setup indicators and actions in compact grouped cards", () => {
    const markup = renderToStaticMarkup(createElement(RulesList, {
      rows: [
        { id: 1, code: "1000", name: "Office chairs", category: "expense", is_active: true, recognition_account_id: 1, settlement_account_id: 2, payable_account_id: 3 },
        { id: 2, code: "1100", name: "Office building", category: "asset", is_active: false },
      ],
      loading: false,
      ...actions,
    }));
    assert.equal((markup.match(/data-testid="gl-rule-group"/g) ?? []).length, 2);
    assert.match(markup, /gap-0 overflow-hidden py-0/);
    assert.match(markup, /Office chairs/);
    assert.match(markup, /Office building/);
    assert.match(markup, /Ready to post/);
    assert.match(markup, /Needs setup/);
    assert.match(markup, /Archived/);
    assert.match(markup, /1 rule on this page/);
    assert.match(markup, /Edit/);
    assert.match(markup, /Archive/);
  });

  it("retains loading and empty states without inventing groups", () => {
    const empty = renderToStaticMarkup(createElement(RulesList, { rows: [], loading: false, ...actions }));
    const loading = renderToStaticMarkup(createElement(RulesList, { rows: [], loading: true, ...actions }));
    assert.match(empty, /No rules found/);
    assert.doesNotMatch(loading, /data-testid="gl-rule-group"/);
    assert.doesNotMatch(loading, /No rules found/);
  });

  it("labels posting accounts correctly for all five rule types", () => {
    const expected = [
      ["expense", "Expense account (Debit)", "expense"],
      ["asset", "Asset account (Debit)", "asset"],
      ["liability", "Liability account (Credit)", "liability"],
      ["income", "Income account (Credit)", "income"],
      ["capital", "Capital / equity account (Credit)", "equity"],
    ];
    const accounts = ["asset", "liability", "equity", "income", "expense"].map((type, index) => ({ id: index + 1, code: String(index + 1), name: type, type }));
    for (const [category, label, type] of expected) {
      const field = resolvedField({ name: "recognition_account_id", label: "Recognition account", accounting: true }, "rules", { accounts, rules: [] }, { category });
      assert.equal(field.label, label);
      assert.equal(field.required, true);
      assert.equal(field.options?.length, 1);
      assert.match(field.options![0].label, new RegExp(type));
    }
  });
});
