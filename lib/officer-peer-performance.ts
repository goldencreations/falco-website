/**
 * Branch peer performance for loan officer dashboards.
 * Ranks officers by customers, applications, lead follow-ups, and collections
 * within a selectable time window.
 */

import type { LeadView } from "@/lib/lead-adapters";
import {
  applicationBelongsToOfficer,
  loanBelongsToOfficer,
  paymentAttributedToOfficer,
} from "@/lib/staff-team-metrics";
import type { Customer, Loan, LoanApplication, Payment, User } from "@/lib/types";

export type OfficerPerformancePeriod = "day" | "week" | "month" | "year" | "term";

/** Number of officers shown in the branch peer rankings table. */
export const PEER_RANKING_TOP_N = 5;

const W_ASSIGNED = 1.2;
const W_CREATED = 1.0;
const W_APPLICATIONS = 0.8;
const W_LOANS = 1.1;
const W_COLLECTIONS = 0.001;

export interface OfficerPeerPerformanceRow {
  rank: number;
  user_id: string;
  full_name: string;
  employee_id: string;
  customers_assigned: number;
  customers_created: number;
  applications: number;
  loans_handled: number;
  lead_follow_ups: number;
  collections_amount: number;
  score: number;
}

function isUsablePeerName(name: string | undefined): boolean {
  const value = name?.trim() ?? "";
  if (!value) return false;
  if (value === "—" || value === "Unassigned") return false;
  if (/^loan officer$/i.test(value)) return false;
  if (/^officer #/i.test(value)) return false;
  if (/^unknown officer$/i.test(value)) return false;
  return true;
}

/** Prefer the most complete registered name (e.g. "Safina Hamisi" over "Safina"). */
export function pickBestOfficerDisplayName(
  ...candidates: (string | undefined | null)[]
): string {
  const usable = candidates
    .map((candidate) => candidate?.trim())
    .filter((candidate): candidate is string => Boolean(candidate) && isUsablePeerName(candidate));
  if (!usable.length) return "";
  return usable.sort((a, b) => {
    const wordDiff = b.split(/\s+/).length - a.split(/\s+/).length;
    if (wordDiff !== 0) return wordDiff;
    return b.length - a.length;
  })[0];
}

/** Primary label for peer rankings — loan officer full name from staff registration. */
export function officerPeerDisplayName(
  row: Pick<OfficerPeerPerformanceRow, "full_name" | "employee_id" | "user_id">,
  fallback?: string
): string {
  const best = pickBestOfficerDisplayName(row.full_name, fallback);
  if (best) return best;
  const employeeId = row.employee_id?.trim();
  if (employeeId) return employeeId;
  return "Unknown officer";
}

const PERIOD_LABELS: Record<OfficerPerformancePeriod, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  term: "This term",
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function idEq(a: unknown, b: string): boolean {
  return String(a ?? "").trim() === b;
}

function customerOfficerId(customer: Customer): string {
  return String(customer.assigned_loan_officer_id ?? "").trim();
}

export function isOfficerPerformancePeriod(value: string): value is OfficerPerformancePeriod {
  return value === "day" || value === "week" || value === "month" || value === "year" || value === "term";
}

export function getOfficerPerformancePeriodRange(period: OfficerPerformancePeriod): {
  from: string;
  to: string;
  label: string;
} {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "day":
      break;
    case "week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      break;
    }
    case "month":
      start.setDate(1);
      break;
    case "year":
      start.setMonth(0, 1);
      break;
    case "term":
      start.setMonth(start.getMonth() - 2);
      start.setDate(1);
      break;
  }

  return {
    from: toIsoDate(start),
    to: toIsoDate(end),
    label: PERIOD_LABELS[period],
  };
}

function isInRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr?.trim()) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

function customerCreatedCountedInPeriod(
  customer: Customer,
  officerId: string,
  from: string,
  to: string
): boolean {
  return idEq(customer.created_by, officerId) && isInRange(customer.created_at, from, to);
}

function leadFollowUpCountedForOfficerInPeriod(
  lead: LeadView,
  officerId: string,
  from: string,
  to: string
): boolean {
  if (!idEq(lead.createdBy, officerId)) return false;
  if (lead.status !== "follow_up" && lead.status !== "contacted" && lead.status !== "converted") {
    return false;
  }

  if (isInRange(lead.followUpDate, from, to)) return true;
  if (isInRange(lead.createdAt, from, to)) return true;
  if (lead.convertedAt && isInRange(lead.convertedAt, from, to)) return true;
  return false;
}

export function computeOfficerPeerPerformance(
  officer: User,
  ctx: {
    customers: Customer[];
    loans: Loan[];
    applications: (LoanApplication & { assigned_officer_id?: string; customer_loan_officer_id?: string })[];
    payments: Payment[];
    leads: LeadView[];
  },
  range: { from: string; to: string }
): Omit<OfficerPeerPerformanceRow, "rank"> {
  const oid = officer.id.trim();
  const customersById = new Map(ctx.customers.map((c) => [c.id, c]));
  const loansById = new Map(ctx.loans.map((l) => [l.id, l]));
  const { from, to } = range;

  const customers_assigned = ctx.customers.filter((c) => idEq(customerOfficerId(c), oid)).length;
  const customers_created = ctx.customers.filter((c) =>
    customerCreatedCountedInPeriod(c, oid, from, to)
  ).length;

  const applications = ctx.applications.filter((app) => {
    if (!applicationBelongsToOfficer(app, oid, customersById)) return false;
    const created = app.created_at ?? (app as { submitted_at?: string }).submitted_at;
    return isInRange(created, from, to);
  }).length;

  const loans_handled = ctx.loans.filter((loan) => {
    if (!loanBelongsToOfficer(loan, oid, customersById)) return false;
    const created =
      loan.disbursement_date ??
      (loan as { created_at?: string }).created_at ??
      (loan as { disbursed_at?: string }).disbursed_at;
    return isInRange(created, from, to);
  }).length;

  const lead_follow_ups = ctx.leads.filter((lead) =>
    leadFollowUpCountedForOfficerInPeriod(lead, oid, from, to)
  ).length;

  const collections_amount = ctx.payments
    .filter((payment) => {
      if (payment.status !== "completed") return false;
      if (!isInRange(payment.payment_date, from, to)) return false;
      return paymentAttributedToOfficer(payment, oid, loansById, customersById);
    })
    .reduce((sum, payment) => sum + payment.amount, 0);

  const score =
    customers_assigned * W_ASSIGNED +
    customers_created * W_CREATED +
    applications * W_APPLICATIONS +
    loans_handled * W_LOANS +
    collections_amount * W_COLLECTIONS;

  return {
    user_id: oid,
    full_name: officer.full_name,
    employee_id: officer.employee_id,
    customers_assigned,
    customers_created,
    applications,
    loans_handled,
    lead_follow_ups,
    collections_amount,
    score,
  };
}

export function rankOfficerPeerPerformance(
  rows: Omit<OfficerPeerPerformanceRow, "rank">[]
): OfficerPeerPerformanceRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.collections_amount !== a.collections_amount) return b.collections_amount - a.collections_amount;
      if (b.loans_handled !== a.loans_handled) return b.loans_handled - a.loans_handled;
      if (b.applications !== a.applications) return b.applications - a.applications;
      return a.full_name.localeCompare(b.full_name);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
