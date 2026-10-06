import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTrialBalanceUrl,
  calendarDateToDateKey,
  dateKeyToCalendarDate,
  defaultTrialBalanceDateRange,
  eatDateKey,
  filterTrialBalanceRows,
  groupTrialBalanceRows,
  isContraAccount,
  type TrialBalanceRow,
} from "./trial-balance";

function row(overrides: Partial<TrialBalanceRow> = {}): TrialBalanceRow {
  return {
    account_id: 1,
    account_code: "1000",
    account_name: "Cash",
    account_type: "asset",
    normal_balance: "debit",
    is_contra: false,
    opening_debit: "100.00",
    opening_credit: "0.00",
    period_debit: "20.10",
    period_credit: "5.05",
    closing_debit: "115.05",
    closing_credit: "0.00",
    debits: "20.10",
    credits: "5.05",
    debit_balance: "115.05",
    credit_balance: "0.00",
    ...overrides,
  };
}

describe("trial balance helpers", () => {
  it("groups in accounting order and calculates exact fixed-minor-unit subtotals", () => {
    const groups = groupTrialBalanceRows([
      row({ account_code: "5000", account_type: "expense", period_debit: "0.20", closing_debit: "0.20" }),
      row({ account_code: "1000", period_debit: "0.10", closing_debit: "0.10" }),
      row({ account_code: "1010", period_debit: "0.20", closing_debit: "0.20" }),
    ]);

    assert.deepEqual(groups.map((group) => group.label), ["Assets", "Expenses"]);
    assert.equal(groups[0].totals.periodDebit, BigInt(30));
    assert.equal(groups[0].totals.closingDebit, BigInt(30));
  });

  it("hides only entirely zero rows when zero activity is off", () => {
    const zero = row({
      account_code: "1010",
      opening_debit: "0.00",
      period_debit: "0.00",
      period_credit: "0.00",
      closing_debit: "0.00",
      debits: "0.00",
      credits: "0.00",
      debit_balance: "0.00",
    });
    const carryingBalance = row({ account_code: "1020", period_debit: "0.00", period_credit: "0.00" });

    assert.deepEqual(filterTrialBalanceRows([zero, carryingBalance], "all", false).map((item) => item.account_code), ["1020"]);
    assert.equal(filterTrialBalanceRows([zero, carryingBalance], "all", true).length, 2);
    assert.equal(filterTrialBalanceRows([zero, carryingBalance], "liability", true).length, 0);
  });

  it("recognizes explicit and normal-side contra accounts", () => {
    assert.equal(isContraAccount(row({ is_contra: true })), true);
    assert.equal(isContraAccount(row({ normal_balance: "credit" })), true);
    assert.equal(isContraAccount(row()), false);
  });

  it("keeps calendar selections civil and derives default dates in EAT", () => {
    const selected = dateKeyToCalendarDate("2026-10-06");
    assert.equal(calendarDateToDateKey(selected), "2026-10-06");
    assert.equal(eatDateKey(new Date("2026-10-06T22:30:00Z")), "2026-10-07");
    assert.deepEqual(defaultTrialBalanceDateRange(new Date("2026-10-06T22:30:00Z")), {
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("builds JSON and CSV proxy URLs with matching filters", () => {
    const filters = { from: "2026-09-01", to: "2026-09-30", type: "asset" as const, includeZeroActivity: false };

    assert.equal(
      buildTrialBalanceUrl(filters),
      "/api/general-ledger/reports/trial-balance?from=2026-09-01&to=2026-09-30&account_type=asset&include_zero_activity=0",
    );
    assert.equal(
      buildTrialBalanceUrl(filters, "csv"),
      "/api/general-ledger/reports/trial-balance?from=2026-09-01&to=2026-09-30&account_type=asset&include_zero_activity=0&format=csv",
    );
  });

  it("lets the backend resolve the default open period when dates are initially empty", () => {
    assert.equal(
      buildTrialBalanceUrl({ from: "", to: "", type: "all", includeZeroActivity: false }),
      "/api/general-ledger/reports/trial-balance?include_zero_activity=0",
    );
  });
});
