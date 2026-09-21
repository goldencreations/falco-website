import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBranchReportCsv } from "./branch-report-csv";
import { buildBranchReportWorkbook } from "./branch-report-excel";

const report = {
  branchName: "All branches",
  periodLabel: "Last 6 Months",
  generatedAt: "21 Sep 2026, 11:36",
  fromDate: "2026-03-21",
  toDate: "2026-09-21",
  summary: {
    totalPortfolio: 83721448.25,
    totalPar: 9002982,
    parRatio: 10.75,
    nplRatio: 0,
    requiredProvision: 450149.1,
  },
  productPerformance: [
    { name: "Business Loan", loanCount: 8, outstanding: 34250710, par: 0, parRate: 0 },
  ],
  agingReport: [
    { classificationLabel: "Watch", outstanding: 8110806, provision: 405540.3, rate: 5 },
  ],
  branchPerformance: [
    {
      name: "Falco Head Office",
      loanCount: 63,
      disbursed: 54869500,
      collected: 10039921,
      outstanding: 83721448.25,
      collectionRate: 10.71,
    },
  ],
  applications: [
    {
      application_number: "APP-100",
      customer_name: "Asha Juma",
      status: "under_review",
      amount: 500000,
      created_at: "20 Sep 2026",
    },
  ],
  customers: [
    {
      customer_number: "CUS-100",
      customer_name: "Asha Juma",
      phone: "255700000000",
      region: "Dar es Salaam",
      district: "Ilala",
      added_at: "18 Sep 2026",
    },
  ],
  loans: [
    {
      loan_number: "LN-100",
      customer_name: "Asha Juma",
      product_name: "Business Loan",
      principal: 500000,
      outstanding: 325000,
      status: "active",
      disbursed_at: "19 Sep 2026",
    },
  ],
  collections: [
    {
      action: "phone_call",
      customer_name: "Asha Juma",
      notes: "Customer promised payment, Friday",
      performed_at: "21 Sep 2026, 09:15",
    },
  ],
};

describe("buildBranchReportCsv", () => {
  it("exports a consistent, human-readable report without JSON payload cells", () => {
    const csv = buildBranchReportCsv(report);
    const lines = csv.trim().split(/\r?\n/);
    const columnCount = lines[0].split(",").length;

    assert.ok(lines.every((line) => line.match(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/g)?.length === columnCount - 1));
    const blankDivider = Array(17).fill("").join(",");

    assert.match(csv, /"PORTFOLIO SUMMARY","Section Header"/);
    assert.match(csv, /"PRODUCT PERFORMANCE","Section Header"/);
    assert.match(csv, /"CUSTOMERS ADDED","Section Header"/);
    assert.match(csv, /"LOANS DISBURSED","Section Header"/);
    assert.match(csv, /snapshots as of 2026-09-21/);
    assert.equal(lines.filter((line) => line === blankDivider).length, 8);
    assert.doesNotMatch(csv, /"Portfolio Summary","Metric"/);
    assert.match(csv, /"Portfolio at risk over 30 days"/);
    assert.match(csv, /"Customer promised payment, Friday"/);
    assert.doesNotMatch(csv, /\{"/);
    assert.doesNotMatch(csv, /section,payload/i);
  });

  it("protects text cells from spreadsheet formulas", () => {
    const csv = buildBranchReportCsv({ ...report, branchName: "=HYPERLINK(\"bad\")" });
    assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  });

  it("builds a styled workbook with every report section on a separate worksheet", () => {
    const workbook = buildBranchReportWorkbook(report);

    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      [
        "Report Details",
        "Portfolio Summary",
        "Product Performance",
        "Portfolio Aging",
        "Branch Performance",
        "Loan Applications",
        "Customers Added",
        "Loans Disbursed",
        "Collection Activities",
      ]
    );

    const summarySheet = workbook.getWorksheet("Portfolio Summary");
    assert.ok(summarySheet);
    assert.equal(summarySheet.getCell("A1").value, "FALCO FINANCIAL SERVICES | PORTFOLIO SUMMARY");
    assert.equal(summarySheet.getCell("A4").value, "Record Type");
    assert.equal(summarySheet.getCell("A1").fill.type, "pattern");
    assert.equal(summarySheet.getCell("A4").fill.type, "pattern");
    assert.equal(summarySheet.views[0]?.state, "frozen");
  });
});
