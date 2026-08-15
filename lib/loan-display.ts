import type { LoanListRow } from "@/lib/loan-adapters";

/** Total repaid: LMS loan balance fields or sum of recorded payments (whichever is higher). */
export function effectiveLoanTotalPaid(loan: LoanListRow): number {
 const fromLoan = Number(loan.total_paid ?? 0);
 const fromPayments = Number(loan.payments_recorded_total ?? 0);
 return Math.max(fromLoan, fromPayments);
}

/** Total repaid across a customer's loans and/or payment rows (whichever is higher). */
export function effectiveCustomerTotalPaid(
 loans: LoanListRow[],
 payments: Array<{ amount?: number; status?: string; ledger_status?: string }> = []
): number {
 const fromLoans = loans.reduce((sum, l) => sum + effectiveLoanTotalPaid(l), 0);
 const fromPayments = payments.reduce((sum, p) => {
 const s = String(p.status ?? "").toLowerCase();
 if (s === "failed" || s === "reversed" || s === "pending") return sum;
 const ledger = String(p.ledger_status ?? "").toLowerCase();
 const settled =
 !s ||
 s === "completed" ||
 s === "verified" ||
 s === "paid" ||
 s === "success" ||
 ledger === "verified" ||
 ledger === "posted";
 if (!settled) return sum;
 const amount = Number(p.amount ?? 0);
 return amount > 0 ? sum + amount : sum;
 }, 0);
 return Math.max(fromLoans, fromPayments);
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

/**
 * Whether new payments may be recorded/accepted for this loan, per
 * `loan.repayment_details.can_accept_payment`. Defaults to `true` (fail-open) when the
 * detail hasn't been loaded yet — this only gates the action once the backend explicitly
 * says `false`.
 */
export function loanAcceptsPayment(loan: Pick<LoanListRow, "repayment_details">): boolean {
 return loan.repayment_details?.can_accept_payment !== false;
}

/** Explanatory text for why "Record Payment" is disabled when `can_accept_payment` is false. */
export const PAYMENT_BLOCKED_HELP_TEXT =
 "This loan is not currently accepting payments (BillPay disabled or fully settled).";
