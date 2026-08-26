import type { LoanListRow } from "@/lib/loan-adapters";
import {
  resolveLoanRepaymentTruth,
  summarizeCustomerPaymentAllocations,
  type PaymentAllocationInput,
} from "@/lib/loan-repayment-truth";

/** @deprecated Prefer resolveLoanRepaymentTruth().contractualPaid — kept for call sites that need a paid figure. */
export function effectiveLoanTotalPaid(loan: LoanListRow): number {
  return resolveLoanRepaymentTruth(loan).contractualPaid;
}

/**
 * Gross cash received from settled payments (includes penalties).
 * Do not use this as loan completion progress.
 */
export function effectiveCustomerCashReceived(
  payments: PaymentAllocationInput[] = []
): number {
  return summarizeCustomerPaymentAllocations(payments).cashReceived;
}

/** Money applied to principal + interest + fees across settled payments. */
export function effectiveCustomerAppliedToContract(
  payments: PaymentAllocationInput[] = []
): number {
  return summarizeCustomerPaymentAllocations(payments).appliedToContract;
}

/**
 * @deprecated Prefer summarizeCustomerPaymentAllocations / contractual totals.
 * Returns gross cash received (legacy name "total paid") for backward-compatible call sites.
 */
export function effectiveCustomerTotalPaid(
  _loans: LoanListRow[],
  payments: PaymentAllocationInput[] = []
): number {
  return effectiveCustomerCashReceived(payments);
}

/** Contractual progress % — never uses gross cash / penalties. */
export function effectivePaidPercent(loan: LoanListRow): number {
  return resolveLoanRepaymentTruth(loan).contractualProgress;
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
