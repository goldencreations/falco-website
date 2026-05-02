/**
 * Per–loan-officer KPIs for branch team dashboards.
 * Score = weighted blend for ranking (tweak weights when product defines official formula).
 */

import type { Customer, Loan, LoanApplication, Payment, User } from "@/lib/types";

const W_ASSIGNED = 1.2;
const W_CREATED = 1.0;
const W_APPS = 0.8;
const W_LOANS = 1.1;
const W_COLLECTIONS = 0.001; // TZS scale

export interface OfficerPerformance {
  user_id: string;
  full_name: string;
  employee_id: string;
  branch_id: string;
  customers_assigned: number;
  customers_created: number;
  applications_count: number;
  loans_handled: number;
  collections_tz_sum: number;
  score: number;
}

export function computeOfficerPerformance(
  officer: User,
  ctx: {
    customers: Customer[];
    loans: Loan[];
    applications: LoanApplication[];
    payments: Payment[];
  }
): OfficerPerformance {
  const oid = officer.id;
  const customers_assigned = ctx.customers.filter(
    (c) => (c.assigned_loan_officer_id ?? c.created_by) === oid
  ).length;
  const customers_created = ctx.customers.filter((c) => c.created_by === oid).length;
  const applications_count = ctx.applications.filter((a) => a.created_by === oid).length;
  const loans_handled = ctx.loans.filter((l) => l.loan_officer_id === oid).length;
  const collections_tz_sum = ctx.payments
    .filter((p) => p.status === "completed" && p.received_by === oid)
    .reduce((s, p) => s + p.amount, 0);

  const score =
    customers_assigned * W_ASSIGNED +
    customers_created * W_CREATED +
    applications_count * W_APPS +
    loans_handled * W_LOANS +
    collections_tz_sum * W_COLLECTIONS;

  return {
    user_id: oid,
    full_name: officer.full_name,
    employee_id: officer.employee_id,
    branch_id: officer.branch_id,
    customers_assigned,
    customers_created,
    applications_count,
    loans_handled,
    collections_tz_sum,
    score,
  };
}

export function rankOfficersByScore(rows: OfficerPerformance[]): OfficerPerformance[] {
  return [...rows].sort((a, b) => b.score - a.score);
}
