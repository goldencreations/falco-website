import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPostingAccounts, isAwaitingAccountingSetup } from "./general-ledger-draft-state";

describe("general ledger draft accounting state", () => {
  it("keeps an unmapped business entry waiting for accounting setup", () => {
    const entry = {
      status: "draft",
      recognition_account_id: null,
      counterpart_account_id: null,
    };

    assert.equal(hasPostingAccounts(entry), false);
    assert.equal(isAwaitingAccountingSetup(entry), true);
  });

  it("requires both posting accounts before preview", () => {
    assert.equal(hasPostingAccounts({ recognition_account_id: "12" }), false);
    assert.equal(hasPostingAccounts({ counterpart_account_id: "21" }), false);
    assert.equal(hasPostingAccounts({ recognition_account_id: "12", counterpart_account_id: "21" }), true);
  });

  it("does not label mapped or non-draft entries as awaiting setup", () => {
    assert.equal(isAwaitingAccountingSetup({ status: "draft", recognition_account_id: "12", counterpart_account_id: "21" }), false);
    assert.equal(isAwaitingAccountingSetup({ status: "posted", recognition_account_id: null, counterpart_account_id: null }), false);
  });
});
