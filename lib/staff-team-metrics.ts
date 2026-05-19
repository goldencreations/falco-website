/**
 * Per–loan-officer KPIs for branch team dashboards.
 * Aggregates live customers, applications, loans, and payments.
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

function idEq(a: unknown, b: string): boolean {
 return String(a ?? "").trim() === b;
}

function customerOfficerId(customer: Customer): string {
 return String(customer.assigned_loan_officer_id ?? "").trim();
}

export function applicationBelongsToOfficer(
 app: LoanApplication & { assigned_officer_id?: string; customer_loan_officer_id?: string },
 officerId: string,
 customersById: Map<string, Customer>
): boolean {
 if (idEq(app.created_by, officerId)) return true;
 if (idEq(app.assigned_officer_id, officerId)) return true;
 if (idEq(app.customer_loan_officer_id, officerId)) return true;
 const cust = customersById.get(app.customer_id);
 if (cust && idEq(customerOfficerId(cust), officerId)) return true;
 return false;
}

export function loanBelongsToOfficer(
 loan: Loan,
 officerId: string,
 customersById?: Map<string, Customer>
): boolean {
 if (idEq(loan.loan_officer_id, officerId)) return true;
 if (idEq(loan.disbursed_by, officerId)) return true;
 if (customersById && loan.customer_id) {
 const cust = customersById.get(loan.customer_id);
 if (cust && idEq(customerOfficerId(cust), officerId)) return true;
 }
 return false;
}

export function paymentAttributedToOfficer(
 payment: Payment,
 officerId: string,
 loansById: Map<string, Loan>,
 customersById?: Map<string, Customer>
): boolean {
 if (payment.status !== "completed") return false;
 if (idEq(payment.received_by, officerId)) return true;
 const loan = loansById.get(payment.loan_id);
 return loan ? loanBelongsToOfficer(loan, officerId, customersById) : false;
}

export function computeOfficerPerformance(
 officer: User,
 ctx: {
 customers: Customer[];
 loans: Loan[];
 applications: (LoanApplication & { assigned_officer_id?: string })[];
 payments: Payment[];
 }
): OfficerPerformance {
 const oid = officer.id.trim();
 const customersById = new Map(ctx.customers.map((c) => [c.id, c]));
 const loansById = new Map(ctx.loans.map((l) => [l.id, l]));

 const customers_assigned = ctx.customers.filter((c) => idEq(customerOfficerId(c), oid)).length;
 const customers_created = ctx.customers.filter((c) => idEq(c.created_by, oid)).length;
 const applications_count = ctx.applications.filter((a) =>
 applicationBelongsToOfficer(a, oid, customersById)
 ).length;
 const loans_handled = ctx.loans.filter((l) => loanBelongsToOfficer(l, oid, customersById)).length;
 const collections_tz_sum = ctx.payments
 .filter((p) => paymentAttributedToOfficer(p, oid, loansById, customersById))
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
