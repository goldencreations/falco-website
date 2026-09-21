import { Workbook, type Worksheet } from "exceljs";
import {
  REPORT_EXPORT_COLUMNS,
  buildBranchReportSections,
  type ReportExportColumn,
  type ReportExportRow,
  type ReportExportValue,
} from "@/lib/branch-report-csv";
import type { ExportBranchReportInput } from "@/lib/branch-report-pdf";

const BRAND_DARK = "FF064E3B";
const WHITE = "FFFFFFFF";
const TEXT = "FF172033";
const MUTED_TEXT = "FF526077";
const BORDER = "FFD5DEE8";

const SECTION_COLORS = [
  "FF0F766E",
  "FF047857",
  "FF0369A1",
  "FFB45309",
  "FF7C3AED",
  "FFBE123C",
  "FF0E7490",
  "FF4F46E5",
  "FF15803D",
] as const;

const COLUMN_WIDTHS: Record<ReportExportColumn, number> = {
  Section: 24,
  "Record Type": 22,
  Reference: 20,
  Name: 28,
  Description: 38,
  Status: 18,
  "Date / Period": 24,
  Count: 12,
  Value: 20,
  Unit: 16,
  "Principal (TZS)": 20,
  "Disbursed (TZS)": 20,
  "Collected (TZS)": 20,
  "Outstanding (TZS)": 20,
  "PAR / Provision (TZS)": 22,
  "Rate (%)": 14,
  Notes: 46,
};

const MONEY_COLUMNS = new Set<ReportExportColumn>([
  "Principal (TZS)",
  "Disbursed (TZS)",
  "Collected (TZS)",
  "Outstanding (TZS)",
  "PAR / Provision (TZS)",
]);

const THIN_BORDER = {
  top: { style: "thin" as const, color: { argb: BORDER } },
  left: { style: "thin" as const, color: { argb: BORDER } },
  bottom: { style: "thin" as const, color: { argb: BORDER } },
  right: { style: "thin" as const, color: { argb: BORDER } },
};

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function protectSpreadsheetText(value: ReportExportValue): ReportExportValue {
  return typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function visibleColumns(rows: ReportExportRow[]): ReportExportColumn[] {
  const columns = REPORT_EXPORT_COLUMNS.filter(
    (column) => column !== "Section" && rows.some((row) => hasValue(row[column]))
  );

  return columns.length > 0 ? columns : ["Record Type", "Name", "Notes"];
}

function styleTitleRows(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  lastColumn: number,
  accent: string
): void {
  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 15, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_DARK } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { bold: true, size: 10, color: { argb: WHITE } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2).height = 21;
  sheet.getRow(3).height = 8;
}

function styleDataCell(
  sheet: Worksheet,
  rowNumber: number,
  columnNumber: number,
  column: ReportExportColumn,
  rowIndex: number
): void {
  const cell = sheet.getCell(rowNumber, columnNumber);
  cell.border = THIN_BORDER;
  cell.font = { size: 10, color: { argb: TEXT } };
  cell.alignment = {
    vertical: "middle",
    horizontal: typeof cell.value === "number" ? "right" : "left",
    wrapText: column === "Description" || column === "Notes",
  };

  if (rowIndex % 2 === 1) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FA" } };
  }
  if (MONEY_COLUMNS.has(column)) cell.numFmt = '#,##0.00;[Red]-#,##0.00';
  if (column === "Rate (%)") cell.numFmt = '0.00"%"';
  if (column === "Count") cell.numFmt = "0";
}

/** Build a color-coded workbook with each report section on its own worksheet. */
export function buildBranchReportWorkbook(input: ExportBranchReportInput): Workbook {
  const workbook = new Workbook();
  workbook.creator = "Falco Financial Services";
  workbook.created = new Date();

  buildBranchReportSections(input).forEach((section, sectionIndex) => {
    const accent = SECTION_COLORS[sectionIndex % SECTION_COLORS.length];
    const columns = visibleColumns(section.rows);
    const sheet = workbook.addWorksheet(section.title, {
      properties: { tabColor: { argb: accent } },
      views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    });

    columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = COLUMN_WIDTHS[column];
    });

    styleTitleRows(
      sheet,
      `FALCO FINANCIAL SERVICES | ${section.title.toUpperCase()}`,
      `${input.branchName} | ${input.periodLabel} | Generated ${input.generatedAt}`,
      columns.length,
      accent
    );

    const headerRow = sheet.getRow(4);
    headerRow.height = 22;
    columns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = column;
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = THIN_BORDER;
    });

    if (section.rows.length === 0) {
      sheet.mergeCells(5, 1, 5, columns.length);
      const emptyCell = sheet.getCell(5, 1);
      emptyCell.value = `No ${section.title.toLowerCase()} records were found for this report.`;
      emptyCell.font = { italic: true, color: { argb: MUTED_TEXT } };
      emptyCell.alignment = { vertical: "middle", horizontal: "center" };
      emptyCell.border = THIN_BORDER;
      sheet.getRow(5).height = 24;
      return;
    }

    section.rows.forEach((reportRow, rowIndex) => {
      const rowNumber = rowIndex + 5;
      const worksheetRow = sheet.getRow(rowNumber);
      worksheetRow.height = 22;
      columns.forEach((column, columnIndex) => {
        worksheetRow.getCell(columnIndex + 1).value = protectSpreadsheetText(reportRow[column]) ?? null;
        styleDataCell(sheet, rowNumber, columnIndex + 1, column, rowIndex);
      });
    });

    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: columns.length },
    };
  });

  return workbook;
}

export async function exportBranchReportExcel(
  input: ExportBranchReportInput,
  filename: string
): Promise<void> {
  const workbook = buildBranchReportWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
