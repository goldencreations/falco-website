/**
 * Staff workspace DTOs and pure selectors. Intended to mirror a future
 * GET /users/:id/workspace response; swap mock inputs for fetch() when the API exists.
 */

import type { Branch, Customer, Loan, Payment, User } from "@/lib/types";
import type { StaffRecord } from "@/components/staff-management/types";

/** Demo “as of” date so month buckets align with mock last_login / payment_date data. */
export const WORKSPACE_REFERENCE_DATE = new Date("2024-01-15T12:00:00Z");

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

export function workspaceIsOnline(lastLogin: string | null): boolean {
  if (!lastLogin) return false;
  const elapsed = Date.now() - new Date(lastLogin).getTime();
  return elapsed <= ONLINE_WINDOW_MS;
}

export interface StaffWorkspaceAccessFlags {
  can_create_applications: boolean;
  can_create_customers: boolean;
}

export interface WorkspaceCustomerRow {
  customer_id: string;
  customer_name: string;
  loan_count: number;
  principal_total: number;
  outstanding_total: number;
  collections_total: number;
}

export interface WorkspaceOfficerSummary {
  user_id: string;
  full_name: string;
  employee_id: string;
  customer_count: number;
  loan_principal_total: number;
}

export interface WorkspaceBranchSection {
  branch_id: string;
  branch_name: string;
  loan_officers: WorkspaceOfficerSummary[];
  customer_preview: WorkspaceCustomerRow[];
  stats: {
    customers: number;
    loans: number;
    principal_disbursed: number;
    outstanding: number;
  };
}

export interface WorkspaceMonthlyPoint {
  month_key: string;
  month_label: string;
  disbursements: number;
  customers_added: number;
  collections: number;
}

export interface StaffWorkspaceMomComparison {
  disbursements_curr: number;
  disbursements_prev: number;
  collections_curr: number;
  collections_prev: number;
  customers_curr: number;
  customers_prev: number;
}

export type StaffWorkspaceVariant = "branch_manager" | "loan_officer" | "limited";

export interface StaffWorkspaceDTO {
  variant: StaffWorkspaceVariant;
  staff_id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  branch_name: string | null;
  manager: { id: string; full_name: string; employee_id: string } | null;
  is_online: boolean;
  last_login: string | null;
  access_defaults: StaffWorkspaceAccessFlags;
  limited_message?: string;
  branch_sections?: WorkspaceBranchSection[];
  collection_by_customer?: WorkspaceCustomerRow[];
  monthly_series: WorkspaceMonthlyPoint[];
  mom_comparison: StaffWorkspaceMomComparison;
}

export interface StaffWorkspaceDeps {
  users: User[];
  branches: Branch[];
  customers: Customer[];
  loans: Loan[];
  payments: Payment[];
}

function customerName(c: Customer): string {
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");
}

function monthKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromField(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return monthKeyFromDate(d);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rollingMonthKeys(ref: Date, count: number): string[] {
  const keys: string[] = [];
  const y = ref.getUTCFullYear();
  const mo = ref.getUTCMonth();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, mo - i, 1));
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

function defaultAccess(): StaffWorkspaceAccessFlags {
  return { can_create_applications: true, can_create_customers: true };
}

function aggregateMonthly(
  monthKeys: string[],
  loansInScope: Loan[],
  customersInScope: Customer[],
  paymentsInScope: Payment[],
): WorkspaceMonthlyPoint[] {
  return monthKeys.map((month_key) => {
    const disbursements = loansInScope
      .filter((l) => monthKeyFromField(l.disbursement_date) === month_key)
      .reduce((s, l) => s + l.principal_amount, 0);

    const customers_added = customersInScope.filter(
      (c) => monthKeyFromField(c.created_at) === month_key,
    ).length;

    const collections = paymentsInScope
      .filter((p) => p.status === "completed" && monthKeyFromField(p.payment_date) === month_key)
      .reduce((s, p) => s + p.amount, 0);

    return {
      month_key,
      month_label: monthLabel(month_key),
      disbursements,
      customers_added,
      collections,
    };
  });
}

function momFromSeries(
  series: WorkspaceMonthlyPoint[],
  currKey: string,
  prevKey: string,
): StaffWorkspaceMomComparison {
  const curr = series.find((p) => p.month_key === currKey);
  const prev = series.find((p) => p.month_key === prevKey);
  return {
    disbursements_curr: curr?.disbursements ?? 0,
    disbursements_prev: prev?.disbursements ?? 0,
    collections_curr: curr?.collections ?? 0,
    collections_prev: prev?.collections ?? 0,
    customers_curr: curr?.customers_added ?? 0,
    customers_prev: prev?.customers_added ?? 0,
  };
}

function buildCustomerPreviewRows(
  customersInBranch: Customer[],
  loansInBranch: Loan[],
  paymentsInBranch: Payment[],
  limit: number,
): WorkspaceCustomerRow[] {
  const loansByCustomer = new Map<string, Loan[]>();
  for (const loan of loansInBranch) {
    const list = loansByCustomer.get(loan.customer_id) ?? [];
    list.push(loan);
    loansByCustomer.set(loan.customer_id, list);
  }

  const payByLoan = new Map<string, Payment[]>();
  for (const p of paymentsInBranch) {
    if (p.status !== "completed") continue;
    const list = payByLoan.get(p.loan_id) ?? [];
    list.push(p);
    payByLoan.set(p.loan_id, list);
  }

  const rows: WorkspaceCustomerRow[] = customersInBranch.map((c) => {
    const ls = loansByCustomer.get(c.id) ?? [];
    let collections_total = 0;
    for (const loan of ls) {
      for (const pay of payByLoan.get(loan.id) ?? []) {
        collections_total += pay.amount;
      }
    }
    return {
      customer_id: c.id,
      customer_name: customerName(c),
      loan_count: ls.length,
      principal_total: ls.reduce((s, l) => s + l.principal_amount, 0),
      outstanding_total: ls.reduce((s, l) => s + l.total_outstanding, 0),
      collections_total,
    };
  });

  rows.sort((a, b) => b.principal_total - a.principal_total);
  return rows.slice(0, limit);
}

export function buildStaffWorkspaceDTO(
  staffId: string,
  staffRecord: StaffRecord | null,
  deps: StaffWorkspaceDeps,
): StaffWorkspaceDTO {
  const { users, branches, customers, loans, payments } = deps;
  const user = users.find((u) => u.id === staffId);
  const role = user?.role ?? staffRecord?.role ?? "unknown";
  const full_name = user?.full_name ?? staffRecord?.full_name ?? "Unknown";
  const branch_id = user?.branch_id ?? staffRecord?.branch_id ?? null;
  const last_login = user?.last_login ?? staffRecord?.last_login ?? null;
  const branch_name = branch_id ? branches.find((b) => b.id === branch_id)?.name ?? null : null;

  const ref = WORKSPACE_REFERENCE_DATE;
  const monthKeys = rollingMonthKeys(ref, 6);
  const currKey = monthKeys[monthKeys.length - 1];
  const prevKey = monthKeys[monthKeys.length - 2];

  const base: Omit<StaffWorkspaceDTO, "variant" | "branch_sections" | "collection_by_customer" | "monthly_series" | "mom_comparison" | "limited_message" | "manager"> & {
    manager: StaffWorkspaceDTO["manager"];
  } = {
    staff_id: staffId,
    full_name,
    role,
    branch_id,
    branch_name,
    manager: null,
    is_online: workspaceIsOnline(last_login),
    last_login,
    access_defaults: defaultAccess(),
  };

  let managerUser: User | undefined;
  if (branch_id) {
    const br = branches.find((b) => b.id === branch_id);
    if (br) {
      managerUser = users.find((u) => u.id === br.manager_id);
      if (managerUser) {
        base.manager = {
          id: managerUser.id,
          full_name: managerUser.full_name,
          employee_id: managerUser.employee_id,
        };
      }
    }
  }

  if (role === "branch_manager" && user) {
    const managedBranches = branches.filter((b) => b.manager_id === staffId);
    const managedIds = new Set(managedBranches.map((b) => b.id));

    const loansInScope = loans.filter((l) => managedIds.has(l.branch_id));
    const customersInScope = customers.filter((c) => managedIds.has(c.branch_id));
    const paymentsInScope = payments.filter((p) => {
      const loan = loans.find((l) => l.id === p.loan_id);
      return loan ? managedIds.has(loan.branch_id) : false;
    });

    const monthly_series = aggregateMonthly(monthKeys, loansInScope, customersInScope, paymentsInScope);
    const mom_comparison = momFromSeries(monthly_series, currKey, prevKey);

    const branch_sections: WorkspaceBranchSection[] = managedBranches.map((br) => {
      const officers = users.filter((u) => u.branch_id === br.id && u.role === "loan_officer");
      const custB = customers.filter((c) => c.branch_id === br.id);
      const loanB = loans.filter((l) => l.branch_id === br.id);
      const loanIds = new Set(loanB.map((l) => l.id));
      const payB = payments.filter((p) => loanIds.has(p.loan_id));

      const loan_officers: WorkspaceOfficerSummary[] = officers.map((o) => {
        const cCount = custB.filter((c) => c.created_by === o.id).length;
        const principal = loanB
          .filter((l) => l.loan_officer_id === o.id)
          .reduce((s, l) => s + l.principal_amount, 0);
        return {
          user_id: o.id,
          full_name: o.full_name,
          employee_id: o.employee_id,
          customer_count: cCount,
          loan_principal_total: principal,
        };
      });

      return {
        branch_id: br.id,
        branch_name: br.name,
        loan_officers,
        customer_preview: buildCustomerPreviewRows(custB, loanB, payB, 8),
        stats: {
          customers: custB.length,
          loans: loanB.length,
          principal_disbursed: loanB.reduce((s, l) => s + l.principal_amount, 0),
          outstanding: loanB.reduce((s, l) => s + l.total_outstanding, 0),
        },
      };
    });

    return {
      ...base,
      variant: "branch_manager",
      branch_sections,
      monthly_series,
      mom_comparison,
    };
  }

  if (role === "loan_officer" && user) {
    const loansInScope = loans.filter((l) => {
      if (l.loan_officer_id === staffId) return true;
      const cust = customers.find((c) => c.id === l.customer_id);
      return cust?.created_by === staffId && cust.branch_id === l.branch_id;
    });
    const customerIds = new Set(loansInScope.map((l) => l.customer_id));
    const customersInScope = customers.filter(
      (c) => customerIds.has(c.id) || (c.created_by === staffId && c.branch_id === branch_id),
    );
    const loanIds = new Set(loansInScope.map((l) => l.id));
    const paymentsInScope = payments.filter(
      (p) => p.received_by === staffId && loanIds.has(p.loan_id),
    );

    const monthly_series = aggregateMonthly(monthKeys, loansInScope, customersInScope, paymentsInScope);
    const mom_comparison = momFromSeries(monthly_series, currKey, prevKey);

    const collection_by_customer: WorkspaceCustomerRow[] = customersInScope.map((c) => {
      const ls = loansInScope.filter((l) => l.customer_id === c.id);
      let collections_total = 0;
      for (const loan of ls) {
        for (const p of paymentsInScope) {
          if (p.loan_id === loan.id) collections_total += p.amount;
        }
      }
      return {
        customer_id: c.id,
        customer_name: customerName(c),
        loan_count: ls.length,
        principal_total: ls.reduce((s, l) => s + l.principal_amount, 0),
        outstanding_total: ls.reduce((s, l) => s + l.total_outstanding, 0),
        collections_total,
      };
    }).sort((a, b) => b.principal_total - a.principal_total);

    return {
      ...base,
      variant: "loan_officer",
      collection_by_customer,
      monthly_series,
      mom_comparison,
    };
  }

  return {
    ...base,
    variant: "limited",
    limited_message:
      "Workspace analytics are optimized for branch managers and loan officers. Use View for profile details.",
    monthly_series: aggregateMonthly(monthKeys, [], [], []),
    mom_comparison: momFromSeries([], currKey, prevKey),
  };
}

/** Body shape for PATCH /users/:id/access (feature flags). */
export interface StaffAccessPatchPayload {
  user_id: string;
  can_create_applications: boolean;
  can_create_customers: boolean;
  updated_by: string;
}
