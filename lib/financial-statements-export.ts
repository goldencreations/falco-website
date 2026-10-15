import type { FinancialStatementsReport, StatementRow } from "@/lib/financial-statements";

type ExcelJsModule = typeof import("exceljs");

export async function downloadBalanceSheet(report: FinancialStatementsReport): Promise<void> {
  await downloadStatement(report, "balance");
}

export async function downloadIncomeStatement(report: FinancialStatementsReport): Promise<void> {
  await downloadStatement(report, "income");
}

async function downloadStatement(report: FinancialStatementsReport, statement: "balance" | "income"): Promise<void> {
  const workbook = await buildFinancialStatementWorkbook(report, statement);
  const definition = statement === "balance" ? report.balance_sheet : report.income_statement;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${definition.code}-${report.period.year}-Q${report.period.quarter}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function buildFinancialStatementWorkbook(report: FinancialStatementsReport, statement: "balance" | "income"): Promise<import("exceljs").Workbook> {
  const module = await import("exceljs");
  const ExcelJS = (module.default ?? module) as ExcelJsModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Falco Financial Statements";
  workbook.created = new Date();
  const isBalance = statement === "balance";
  const definition = isBalance ? report.balance_sheet : report.income_statement;
  const worksheet = workbook.addWorksheet(definition.code, { views: [{ state: "frozen", ySplit: 6 }] });
  const institution = report.metadata?.institution_name?.trim() || "Institution name not configured";
  const mspCode = report.metadata?.institution_code?.trim() || report.metadata?.msp_code?.trim() || "MSP code not configured";
  const title = isBalance ? "MSP2_01 — Balance Sheet" : "MSP2_02 — Income and Expense Statement";
  const period = isBalance
    ? `As of ${report.period.to}`
    : `Quarter ${report.period.quarter}: ${report.period.from} to ${report.period.to}; Calendar YTD: ${report.period.ytd_from} to ${report.period.to}`;

  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").font = { bold: true, size: 16 };
  worksheet.mergeCells("A2:D2");
  worksheet.getCell("A2").value = institution;
  worksheet.mergeCells("A3:D3");
  worksheet.getCell("A3").value = `MSP code: ${mspCode}`;
  worksheet.mergeCells("A4:D4");
  worksheet.getCell("A4").value = `${period} · ${report.period.currency}`;
  if (report.completeness.status !== "complete" || report.warnings.length > 0) {
    worksheet.mergeCells("A5:D5");
    const warnings = report.warnings.map((warning) => typeof warning === "string" ? warning : warning.message);
    worksheet.getCell("A5").value = [report.completeness.status === "complete" ? "Review information" : "Report needs review", ...warnings].join(". ");
    worksheet.getCell("A5").alignment = { wrapText: true, vertical: "middle" };
    worksheet.getRow(5).height = Math.max(32, Math.ceil(String(worksheet.getCell("A5").value).length / 115) * 15);
    worksheet.getCell("A5").font = { color: { argb: "FF92400E" }, size: 10 };
  }
  worksheet.getRow(6).values = isBalance
    ? ["Code", "Description", "Amount"]
    : ["Code", "Description", `Quarter ${report.period.quarter}`, `Calendar YTD from ${report.period.ytd_from}`];
  worksheet.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };

  definition.rows.forEach((row) => addStatementRow(worksheet, row, isBalance));
  applyExcelFormulas(worksheet, definition.rows, isBalance);
  worksheet.columns = [{ width: 16 }, { width: 58 }, { width: 22 }, { width: 22 }];
  worksheet.getColumn(3).numFmt = "#,##0.00;[Red]-#,##0.00";
  worksheet.getColumn(4).numFmt = "#,##0.00;[Red]-#,##0.00";
  worksheet.autoFilter = isBalance ? "A6:C6" : "A6:D6";
  worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  worksheet.pageSetup.printTitlesRow = "1:6";
  return workbook;
}

function addStatementRow(worksheet: import("exceljs").Worksheet, row: StatementRow, isBalance: boolean): void {
  const values: Array<string | number | null> = [row.code, `${"   ".repeat(Math.max(0, row.depth))}${row.label}`];
  if (row.kind === "heading") {
    values.push(null);
    if (!isBalance) values.push(null);
  } else if (isBalance) {
    values.push(toExcelNumber(row.amount));
  } else {
    values.push(toExcelNumber(row.quarter_amount), toExcelNumber(row.ytd_amount));
  }
  const excelRow = worksheet.addRow(values);
  if (row.kind !== "detail") {
    excelRow.font = { bold: true };
  }
  if (row.kind === "heading") {
    excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  }
  excelRow.alignment = { vertical: "middle", wrapText: true };
  excelRow.height = Math.max(21, Math.ceil((row.label.length + row.depth * 3) / 53) * 16);
}

function applyExcelFormulas(worksheet: import("exceljs").Worksheet, rows: StatementRow[], isBalance: boolean): void {
  const sheetRowsByCode = new Map(rows.map((row, index) => [row.code, index + 7]));
  rows.forEach((row, index) => {
    if (isBalance && /current.*(profit|surplus|deficit)|(profit|surplus|deficit).*current/i.test(row.label)) {
      worksheet.getCell(index + 7, 3).note = "Cached from the same report snapshot's MSP2_02 calendar YTD result; no external workbook link is used.";
    }
    if (!row.formula_components?.length || row.kind === "detail" || row.kind === "heading") return;
    const references = row.formula_components.map((component) => ({ ...component, row: sheetRowsByCode.get(component.code) }));
    if (references.some((reference) => !reference.row)) {
      return;
    }
    const columns = isBalance ? [3] : [3, 4];
    columns.forEach((column) => {
      const formula = references.map((reference, componentIndex) => {
        const address = worksheet.getCell(reference.row!, column).address;
        if (componentIndex === 0) return reference.sign === -1 ? `-${address}` : address;
        return `${reference.sign === -1 ? "-" : "+"}${address}`;
      }).join("");
      const result = toExcelNumber(isBalance ? row.amount : column === 3 ? row.quarter_amount : row.ytd_amount) ?? 0;
      worksheet.getCell(index + 7, column).value = { formula, result };
    });
  });
}

function toExcelNumber(value?: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
