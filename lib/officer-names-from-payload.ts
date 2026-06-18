/**
 * Resolve loan-officer display names from Falco API list payloads.
 * Loan officers often cannot call GET /users for peers; nested user objects on
 * applications, loans, customers, and branch summary still carry full_name.
 */

function isUsableOfficerName(name: string | undefined): boolean {
  const value = name?.trim() ?? "";
  if (!value) return false;
  if (value === "—" || value === "Unassigned") return false;
  if (/^loan officer$/i.test(value)) return false;
  if (/^officer #/i.test(value)) return false;
  if (/^unknown officer$/i.test(value)) return false;
  return true;
}

function listRows(json: unknown, keys: string[]): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  for (const key of keys) {
    const candidate = o[key];
    if (Array.isArray(candidate)) {
      return candidate.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    }
  }
  if (Array.isArray(json)) {
    return json.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  }
  return [];
}

function unwrapRecord(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const inner = row[key];
    if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  }
  return row;
}

function ingestUserRef(
  names: Map<string, string>,
  id: unknown,
  name: unknown,
  nested?: unknown
): void {
  if (nested && typeof nested === "object") {
    const record = nested as Record<string, unknown>;
    const userId = String(record.id ?? record.user_id ?? id ?? "").trim();
    const userName = String(record.full_name ?? record.name ?? name ?? "").trim();
    if (userId && isUsableOfficerName(userName)) {
      names.set(userId, userName);
    }
    return;
  }

  const userId = String(id ?? "").trim();
  const userName = String(name ?? "").trim();
  if (userId && isUsableOfficerName(userName)) {
    names.set(userId, userName);
  }
}

function walkSummaryPayload(json: unknown, names: Map<string, string>): void {
  const rows = listRows(json, ["summaries", "summary", "branches", "data", "rows"]);
  for (const row of rows) {
    for (const key of ["officers", "loan_officers", "staff", "users"]) {
      const pool = row[key];
      if (!Array.isArray(pool)) continue;
      for (const item of pool) {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          ingestUserRef(
            names,
            record.id ?? record.user_id ?? record.officer_id,
            record.full_name ?? record.name ?? record.officer_name,
            record
          );
        }
      }
    }
    const single = row.loan_officer;
    if (single && typeof single === "object") {
      const record = single as Record<string, unknown>;
      ingestUserRef(
        names,
        record.id ?? record.user_id,
        record.full_name ?? record.name,
        record
      );
    }
  }
}

function walkApplicationPayload(json: unknown, names: Map<string, string>): void {
  for (const raw of listRows(json, ["data", "applications"])) {
    const app = unwrapRecord(raw, ["application"]);
    ingestUserRef(
      names,
      app.created_by,
      app.created_by_name,
      app.creator ?? app.created_by_user
    );
    ingestUserRef(
      names,
      app.assigned_officer_id ?? app.loan_officer_id,
      app.assigned_officer_name ?? app.officer_name ?? app.loan_officer_name,
      app.assigned_officer ?? app.loan_officer ?? app.officer
    );
  }
}

function walkLoanPayload(json: unknown, names: Map<string, string>): void {
  for (const raw of listRows(json, ["data", "loans", "items"])) {
    const loan = unwrapRecord(raw, ["loan"]);
    ingestUserRef(
      names,
      loan.loan_officer_id ?? loan.assigned_officer_id,
      loan.loan_officer_name ?? loan.officer_name,
      loan.loan_officer ?? loan.assigned_officer ?? loan.officer
    );
    ingestUserRef(
      names,
      loan.disbursed_by ?? loan.disbursed_by_id,
      loan.disbursed_by_name,
      loan.disbursed_by_user
    );
  }
}

function walkCustomerPayload(json: unknown, names: Map<string, string>): void {
  for (const raw of listRows(json, ["data", "customers"])) {
    const customer = unwrapRecord(raw, ["customer"]);
    ingestUserRef(
      names,
      customer.assigned_loan_officer_id ?? customer.loan_officer_id,
      customer.assigned_officer_name ?? customer.loan_officer_name,
      customer.loan_officer ?? customer.assigned_officer ?? customer.relationship_manager
    );
    ingestUserRef(
      names,
      customer.created_by,
      customer.created_by_name,
      customer.creator ?? customer.created_by_user
    );
  }
}

function walkPaymentPayload(json: unknown, names: Map<string, string>): void {
  for (const raw of listRows(json, ["data", "payments"])) {
    const payment = unwrapRecord(raw, ["payment"]);
    ingestUserRef(
      names,
      payment.received_by ?? payment.received_by_id,
      payment.received_by_name,
      payment.received_by_user ?? payment.receiver
    );
  }
}

export type OfficerNamePayloadSources = {
  rawApplications?: unknown;
  rawLoans?: unknown;
  rawCustomers?: unknown;
  rawPayments?: unknown;
  rawBranchesSummary?: unknown;
  rawBranchExport?: unknown;
};

function walkBranchExportPayload(json: unknown, names: Map<string, string>): void {
  if (!json || typeof json !== "object") return;
  const branch = (json as Record<string, unknown>).branch;
  if (!branch || typeof branch !== "object") return;
  const pool = (branch as Record<string, unknown>).loan_officers;
  if (!Array.isArray(pool)) return;
  for (const item of pool) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    ingestUserRef(
      names,
      record.id ?? record.user_id ?? record.officer_id,
      record.full_name ?? record.name ?? record.officer_name,
      record
    );
  }
}

/** Build id → full_name map from Falco list payloads visible to loan officers. */
export function buildOfficerNameDirectoryFromApiPayloads(
  sources: OfficerNamePayloadSources
): Map<string, string> {
  const names = new Map<string, string>();

  if (sources.rawBranchesSummary) walkSummaryPayload(sources.rawBranchesSummary, names);
  if (sources.rawBranchExport) walkBranchExportPayload(sources.rawBranchExport, names);
  if (sources.rawApplications) walkApplicationPayload(sources.rawApplications, names);
  if (sources.rawLoans) walkLoanPayload(sources.rawLoans, names);
  if (sources.rawCustomers) walkCustomerPayload(sources.rawCustomers, names);
  if (sources.rawPayments) walkPaymentPayload(sources.rawPayments, names);

  return names;
}

export { isUsableOfficerName as isUsableOfficerDisplayName };
