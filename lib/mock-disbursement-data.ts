/**
 * Mock disbursement ledger + eligibility.
 *
 * Eligibility rule (matches product intent; backend can map 1:1):
 * - Loan must be `pending_disbursement` (approved book, not yet released on the loan record).
 * - Remaining schedulable amount = `principal_amount` − sum(`amount` for rows whose status is not `rejected`).
 *   (Completed, pending_approval, and approved rows all consume the approved principal bucket.)
 */

import { loans, getCustomerById } from "@/lib/mock-data";
import type { Loan } from "@/lib/types";
import type {
  Disbursement,
  DisbursementCreateInput,
  DisbursementListQuery,
  DisbursementPatchAction,
  DisbursementStatus,
} from "@/lib/disbursement-types";

let disbursements: Disbursement[] = [
  {
    id: "disb-001",
    loan_id: "loan-001",
    amount: 2_000_000,
    method: "mpesa",
    account_name: "Juma Rashid",
    account_number: "+255754111222",
    bank_name: null,
    transaction_reference: "MPX23NOV001",
    status: "completed",
    prepared_by: "usr-003",
    approved_by: "usr-002",
    approved_at: "2023-11-01T09:00:00.000Z",
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    disbursed_at: "2023-11-01T09:15:00.000Z",
    notes: "Initial tranche — mobile wallet.",
    created_at: "2023-11-01T08:45:00.000Z",
    updated_at: "2023-11-01T09:15:00.000Z",
  },
  {
    id: "disb-002",
    loan_id: "loan-003",
    amount: 4_000_000,
    method: "crdb",
    account_name: "Neema Kija",
    account_number: "0150123456789",
    bank_name: "CRDB Bank",
    transaction_reference: "CRDB-FT-88421",
    status: "completed",
    prepared_by: "usr-003",
    approved_by: "usr-001",
    approved_at: "2023-12-01T11:00:00.000Z",
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    disbursed_at: "2023-12-01T11:30:00.000Z",
    notes: "Salary loan disbursement.",
    created_at: "2023-12-01T10:40:00.000Z",
    updated_at: "2023-12-01T11:30:00.000Z",
  },
  {
    id: "disb-003",
    loan_id: "loan-011",
    amount: 800_000,
    method: "mpesa",
    account_name: "Fatma Omari",
    account_number: "+255788334455",
    bank_name: null,
    transaction_reference: null,
    status: "pending_approval",
    prepared_by: "usr-003",
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    disbursed_at: null,
    notes: "First release pending branch manager sign-off.",
    created_at: "2024-01-21T08:00:00.000Z",
    updated_at: "2024-01-21T08:00:00.000Z",
  },
  {
    id: "disb-004",
    loan_id: "loan-012",
    amount: 2_000_000,
    method: "nmb",
    account_name: "Idris Mbeki",
    account_number: "204012998877",
    bank_name: "NMB Bank",
    transaction_reference: null,
    status: "approved",
    prepared_by: "usr-009",
    approved_by: "usr-007",
    approved_at: "2024-01-19T14:00:00.000Z",
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    disbursed_at: null,
    notes: "Approved — awaiting treasury release.",
    created_at: "2024-01-18T16:00:00.000Z",
    updated_at: "2024-01-19T14:00:00.000Z",
  },
  {
    id: "disb-005",
    loan_id: "loan-010",
    amount: 500_000,
    method: "airtel_money",
    account_name: "Rose Kimaro",
    account_number: "+255699887766",
    bank_name: null,
    transaction_reference: null,
    status: "rejected",
    prepared_by: "usr-009",
    approved_by: null,
    approved_at: null,
    rejected_by: "usr-007",
    rejected_at: "2024-01-10T10:00:00.000Z",
    rejection_reason: "KYC refresh required before additional disbursement.",
    disbursed_at: null,
    notes: "Top-up attempt — declined.",
    created_at: "2024-01-09T15:00:00.000Z",
    updated_at: "2024-01-10T10:00:00.000Z",
  },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Sum of amounts for this loan where status is not rejected (reserves against approved principal). */
export function sumScheduledOrCompletedForLoan(loanId: string): number {
  return disbursements
    .filter((d) => d.loan_id === loanId && d.status !== "rejected")
    .reduce((s, d) => s + d.amount, 0);
}

export function getRemainingPrincipalBucket(loan: Loan): number {
  return Math.max(0, loan.principal_amount - sumScheduledOrCompletedForLoan(loan.id));
}

export function getEligibleLoansForDisbursement(): Loan[] {
  return loans.filter((loan) => {
    if (loan.status !== "pending_disbursement") return false;
    return getRemainingPrincipalBucket(loan) > 0.009;
  });
}

function matchesSearch(row: Disbursement, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const loan = loans.find((l) => l.id === row.loan_id);
  const customer = loan ? getCustomerById(loan.customer_id) : undefined;
  const loanNo = loan?.loan_number.toLowerCase() ?? "";
  const name =
    customer ? `${customer.first_name} ${customer.last_name}`.toLowerCase() : "";
  return (
    loanNo.includes(q) ||
    name.includes(q) ||
    row.id.toLowerCase().includes(q) ||
    (row.transaction_reference?.toLowerCase().includes(q) ?? false)
  );
}

export function listDisbursements(query: DisbursementListQuery = {}): Disbursement[] {
  const status = query.status ?? "all";
  const loanId = query.loan_id;
  const search = query.search ?? "";

  return disbursements
    .filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (loanId && row.loan_id !== loanId) return false;
      if (!matchesSearch(row, search)) return false;
      return true;
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function getDisbursementById(id: string): Disbursement | undefined {
  return disbursements.find((d) => d.id === id);
}

export function getDisbursementKpis() {
  const list = [...disbursements];
  const byStatus = (s: DisbursementStatus) => list.filter((d) => d.status === s).length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdCompleted = list
    .filter((d) => d.status === "completed" && d.disbursed_at && new Date(d.disbursed_at) >= monthStart)
    .reduce((s, d) => s + d.amount, 0);
  return {
    pending_approval: byStatus("pending_approval"),
    approved: byStatus("approved"),
    completed: byStatus("completed"),
    rejected: byStatus("rejected"),
    mtd_completed_volume: mtdCompleted,
  };
}

export function createDisbursement(
  input: DisbursementCreateInput,
  preparedBy: string
): { ok: true; disbursement: Disbursement } | { ok: false; error: string } {
  const loan = loans.find((l) => l.id === input.loan_id);
  if (!loan) return { ok: false, error: "Loan not found" };
  if (loan.status !== "pending_disbursement") {
    return { ok: false, error: "Loan is not in pending_disbursement status" };
  }
  const remaining = getRemainingPrincipalBucket(loan);
  if (input.amount <= 0 || input.amount > remaining + 0.01) {
    return {
      ok: false,
      error: `Amount must be positive and at most remaining principal bucket (${remaining.toFixed(0)} TZS)`,
    };
  }

  const now = new Date().toISOString();
  const row: Disbursement = {
    id: uid("disb"),
    loan_id: input.loan_id,
    amount: input.amount,
    method: input.method,
    account_name: input.account_name ?? null,
    account_number: input.account_number ?? null,
    bank_name: input.bank_name ?? null,
    transaction_reference: input.transaction_reference ?? null,
    status: "pending_approval",
    prepared_by: preparedBy,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    disbursed_at: null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };
  disbursements = [row, ...disbursements];
  return { ok: true, disbursement: row };
}

export function patchDisbursement(
  id: string,
  patch: DisbursementPatchAction
): { ok: true; disbursement: Disbursement } | { ok: false; error: string } {
  const idx = disbursements.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, error: "Disbursement not found" };
  const row = disbursements[idx];
  const now = new Date().toISOString();

  if (patch.action === "approve") {
    if (row.status !== "pending_approval") {
      return { ok: false, error: "Only pending_approval can be approved" };
    }
    const next: Disbursement = {
      ...row,
      status: "approved",
      approved_by: patch.approved_by,
      approved_at: now,
      updated_at: now,
    };
    disbursements = disbursements.map((d) => (d.id === id ? next : d));
    return { ok: true, disbursement: next };
  }

  if (patch.action === "reject") {
    if (row.status !== "pending_approval") {
      return { ok: false, error: "Only pending_approval can be rejected" };
    }
    const next: Disbursement = {
      ...row,
      status: "rejected",
      rejected_by: patch.rejected_by,
      rejected_at: now,
      rejection_reason: patch.rejection_reason ?? null,
      updated_at: now,
    };
    disbursements = disbursements.map((d) => (d.id === id ? next : d));
    return { ok: true, disbursement: next };
  }

  if (patch.action === "complete") {
    if (row.status !== "approved") {
      return { ok: false, error: "Only approved disbursements can be marked completed" };
    }
    const next: Disbursement = {
      ...row,
      status: "completed",
      transaction_reference: patch.transaction_reference ?? row.transaction_reference,
      disbursed_at: patch.disbursed_at ?? now,
      updated_at: now,
    };
    disbursements = disbursements.map((d) => (d.id === id ? next : d));
    return { ok: true, disbursement: next };
  }

  return { ok: false, error: "Unknown action" };
}
