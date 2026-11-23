import assert from "node:assert/strict";
import { it } from "node:test";
import { statementReadinessMessage } from "./financial-statements";

const report = {
  completeness: { status: "incomplete" as const, mapped_accounts: 103, total_accounts: 105, ratio: "0.9810", mapping_complete: true, data_ready: false },
  unmapped_accounts: [],
  checks: [{ code: "balance_sheet_equation", passed: true }],
};

it("does not blame unused uncategorised accounts for a historical review gap", () => {
  const message = statementReadinessMessage(report);
  assert.match(message, /Accounts with report activity have valid report categories/);
  assert.match(message, /historical review/);
  assert.doesNotMatch(message, /103|105|unmapped balances/);
});

it("continues to flag actual unmapped activity and failed balance checks", () => {
  assert.match(statementReadinessMessage({ ...report, unmapped_accounts: [{ id: 1, code: "A", name: "Unmapped", reason: "missing_category", balance: "10.00" }] }), /need a compatible report category/);
  assert.match(statementReadinessMessage({ ...report, checks: [{ passed: false }] }), /do not pass/);
});

it("only describes a report as passing when the server marks it complete", () => {
  assert.match(statementReadinessMessage({ ...report, completeness: { ...report.completeness, status: "complete", data_ready: true } }), /posted balances pass/);
  assert.match(statementReadinessMessage(report), /before treating these statements as complete/);
});
