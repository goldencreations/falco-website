import type { LoanListRow } from "@/lib/loan-adapters";

/** Total repaid: LMS loan balance fields or sum of recorded payments (whichever is higher). */
export function effectiveLoanTotalPaid(loan: LoanListRow): number {
 const fromLoan = Number(loan.total_paid ?? 0);
 const fromPayments = Number(loan.payments_recorded_total ?? 0);
 return Math.max(fromLoan, fromPayments);
}

export function effectivePaidPercent(loan: LoanListRow): number {
 const total = Number(loan.total_amount ?? 0);
 if (total <= 0) return 0;
 const pct = (effectiveLoanTotalPaid(loan) / total) * 100;
 return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
}

export function loanCustomerLabel(loan: LoanListRow): string {
 const name = loan.customerDisplayName?.trim();
 if (name && name !== "—" && name !== "Customer" && name !== "Unknown") return name;
 return "—";
}

export function loanProductLabel(loan: LoanListRow): string {
 const name = loan.productName?.trim();
 if (name && name !== "—" && name !== "Product") return name;
 return "—";
}
