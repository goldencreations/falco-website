import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApplicationViewRow } from "./application-adapters";
import type { LoanListRow } from "./loan-adapters";
import {
  mapReportApplications,
  mapReportCustomers,
  mapReportLoans,
} from "./report-export-data";
import type { Customer } from "./types";

describe("report export period rows", () => {
  it("includes applications and customers only when they were added inside the inclusive range", () => {
    const applications = [
      { id: "1", application_number: "APP-1", created_at: "2026-08-01T00:00:00Z", status: "pending", requested_amount: 10 },
      { id: "2", application_number: "APP-2", created_at: "2026-09-01T00:00:00Z", status: "pending", requested_amount: 20 },
    ] as unknown as ApplicationViewRow[];
    const customers = [
      { id: "1", customer_number: "CUS-1", first_name: "First", last_name: "Included", created_at: "2026-08-31T23:59:59Z" },
      { id: "2", customer_number: "CUS-2", first_name: "Second", last_name: "Excluded", created_at: "2026-07-31T23:59:59Z" },
    ] as unknown as Customer[];

    assert.deepEqual(
      mapReportApplications(applications, "2026-08-01", "2026-08-31").map((row) => row.application_number),
      ["APP-1"]
    );
    assert.deepEqual(
      mapReportCustomers(customers, "2026-08-01", "2026-08-31").map((row) => row.customer_number),
      ["CUS-1"]
    );
  });

  it("includes only loans disbursed inside the inclusive range", () => {
    const loans = [
      { id: "1", loan_number: "LN-1", disbursement_date: "2026-08-01", status: "active" },
      { id: "2", loan_number: "LN-2", disbursement_date: "2026-08-31", status: "active" },
      { id: "3", loan_number: "LN-3", disbursement_date: "2026-09-01", status: "active" },
    ] as unknown as LoanListRow[];

    assert.deepEqual(
      mapReportLoans(loans, "2026-08-01", "2026-08-31").map((row) => row.loan_number),
      ["LN-1", "LN-2"]
    );
  });
});
