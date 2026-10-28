import { strict as assert } from "node:assert";
import { test } from "node:test";
import { entryAccountOptions } from "./general-ledger-account-options";

const accounts = [
  { id: 1, code: "1000", name: "Cash on Hand" },
  { id: 2, code: "4020", name: "Penalty Income" },
  { id: 3, code: "COA-1201", name: "User cash account" },
];

test("new entries offer only user-created chart accounts", () => {
  assert.deepEqual(entryAccountOptions(accounts).map(account => account.id), [3]);
  assert.deepEqual(entryAccountOptions(accounts.slice(0, 2)), []);
  assert.equal(accounts.length, 3);
});

test("editing preserves only the saved legacy account alongside user accounts", () => {
  assert.deepEqual(entryAccountOptions(accounts, "1").map(account => account.id), [1, 3]);
  assert.deepEqual(entryAccountOptions(accounts, "3").map(account => account.id), [3]);
  assert.equal(accounts[0].name, "Cash on Hand");
});
