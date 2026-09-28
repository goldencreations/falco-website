import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedAccountTypes,
  isRuleReady,
  postingConfigurationIssue,
  requiredPostingFields,
} from "./general-ledger-rule-setup";

describe("general ledger rule posting setup", () => {
  it("requires the accounts used by each business group", () => {
    assert.deepEqual(requiredPostingFields("expense"), ["recognition_account_id", "settlement_account_id", "payable_account_id"]);
    assert.deepEqual(requiredPostingFields("asset"), ["recognition_account_id", "settlement_account_id", "payable_account_id"]);
    assert.deepEqual(requiredPostingFields("liability"), ["recognition_account_id", "settlement_account_id"]);
  });

  it("marks complete rules ready while preserving optional grant setup", () => {
    assert.equal(isRuleReady({ category: "asset", recognition_account_id: "1", settlement_account_id: "2", payable_account_id: "3" }), true);
    assert.equal(isRuleReady({ category: "asset", recognition_account_id: "1", settlement_account_id: "2" }), false);
  });

  it("filters account choices according to their accounting role", () => {
    assert.deepEqual(allowedAccountTypes("recognition_account_id", "expense"), ["expense"]);
    assert.deepEqual(allowedAccountTypes("payable_account_id", "asset"), ["liability"]);
    assert.deepEqual(allowedAccountTypes("settlement_account_id", "liability"), ["asset", "expense"]);
  });

  it("blocks an entry before saving when its selected path is not configured", () => {
    const paidExpenseRule = { recognition_account_id: "1", settlement_account_id: "2", payable_account_id: null };
    assert.equal(postingConfigurationIssue("expenses", { settlement_status: "paid" }, paidExpenseRule), null);
    assert.match(postingConfigurationIssue("expenses", { settlement_status: "unpaid" }, paidExpenseRule) ?? "", /Accounts Payable/);

    const boughtAssetRule = { recognition_account_id: "1", settlement_account_id: "2", payable_account_id: "3", grant_counterpart_account_id: null };
    assert.match(postingConfigurationIssue("assets", { acquisition_type: "granted" }, boughtAssetRule) ?? "", /grant or donation/);
  });
});
