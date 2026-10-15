import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { buildFinancialStatementWorkbook } from "./financial-statements-export";
import { statementUrl, type FinancialStatementsReport, type StatementRow } from "./financial-statements";

function report(): FinancialStatementsReport {
  const balance: StatementRow[] = [
    { code: "1", label: "Cash and cash equivalents", depth: 0, kind: "subtotal", amount: "100.30", accounts: [], formula_components: [{ code: "1.a", sign: 1 }, { code: "1.b", sign: 1 }] },
    { code: "1.a", label: "Cash in hand", depth: 1, kind: "detail", amount: "0.10", accounts: [] },
    { code: "1.b", label: "Bank balances", depth: 1, kind: "detail", amount: "100.20", accounts: [] },
    { code: "15.h", label: "Current-year profit/(loss)", depth: 1, kind: "detail", amount: "-5.10", accounts: [] },
  ];
  const income: StatementRow[] = [
    { code: "8", label: "Profit/(loss) before tax", depth: 0, kind: "detail", quarter_amount: "50.20", ytd_amount: "100.30", accounts: [] },
    { code: "9", label: "Income tax provision", depth: 0, kind: "detail", quarter_amount: "5.10", ytd_amount: "10.20", accounts: [] },
    { code: "10", label: "Profit/(loss) after tax", depth: 0, kind: "subtotal", quarter_amount: "45.10", ytd_amount: "90.10", accounts: [], formula_components: [{ code: "8", sign: 1 }, { code: "9", sign: -1 }] },
  ];
  return {
    metadata: { institution_name: "Falco Financial Services Limited", msp_code: "TEST-CODE" },
    period: { year: 2026, quarter: 2, from: "2026-04-01", to: "2026-06-30", ytd_from: "2026-01-01", financial_year_start: "2026-01-01", currency: "TZS" },
    balance_sheet: { code: "MSP2_01", rows: balance },
    income_statement: { code: "MSP2_02", rows: income },
    warnings: [], unmapped_accounts: [],
    completeness: { status: "complete", mapped_accounts: 2, total_accounts: 2, ratio: 1 },
  };
}

describe("financial statement Excel exports", () => {
  it("preserves forward subtotal references, exact displayed cents, zero rows, and snapshot profit", async () => {
    const input = report();
    input.balance_sheet.rows.push({ code: "16", label: "Zero row", depth: 0, kind: "detail", amount: "0.00", accounts: [] });
    const workbook = await buildFinancialStatementWorkbook(input, "balance");
    const saved = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(saved);
    const sheet = reopened.getWorksheet("MSP2_01")!;
    assert.equal(reopened.worksheets.length, 1);
    assert.equal(sheet.rowCount, 6 + input.balance_sheet.rows.length);
    assert.deepEqual(sheet.getCell("C7").value, { formula: "C8+C9", result: 100.3 });
    assert.equal(sheet.getCell("C8").value, 0.1);
    assert.equal(sheet.getCell("C10").value, -5.1);
    assert.equal(sheet.getCell("C11").value, 0);
    assert.match(JSON.stringify(sheet.getCell("C10").note), /same report snapshot/);
    assert.equal(sheet.getCell("C8").numFmt, "#,##0.00;[Red]-#,##0.00");
    assert.equal(sheet.getCell("A2").value, input.metadata!.institution_name);
  });

  it("keeps quarter and year-to-date figures in separate numeric columns and subtraction formulas", async () => {
    const input = report();
    const workbook = await buildFinancialStatementWorkbook(input, "income");
    const sheet = workbook.getWorksheet("MSP2_02")!;
    assert.equal(sheet.rowCount, 6 + input.income_statement.rows.length);
    assert.deepEqual(sheet.getCell("C9").value, { formula: "C7-C8", result: 45.1 });
    assert.deepEqual(sheet.getCell("D9").value, { formula: "D7-D8", result: 90.1 });
    assert.equal(sheet.getCell("C7").value, 50.2);
    assert.equal(sheet.getCell("D7").value, 100.3);
    assert.match(String(sheet.getCell("A4").value), /2026-04-01 to 2026-06-30/);
  });

  it("uses the same report filters for preview and export authorization", () => {
    assert.equal(statementUrl(2026, 2), "/api/general-ledger/reports/financial-statements?year=2026&quarter=2");
    assert.equal(statementUrl(2026, 2, true), "/api/general-ledger/reports/financial-statements?year=2026&quarter=2&format=xlsx_data");
  });
});
