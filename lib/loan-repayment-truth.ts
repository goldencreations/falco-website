/**
 * Truthful loan repayment progress — never treat gross cash (including penalties)
 * as contractual completion.
 */

export type LoanRepaymentTruthInput = {
  id?: string;
  loan_number?: string;
  principal?: number;
  principal_amount?: number;
  total_repayment?: number;
  total_amount?: number;
  principal_outstanding?: number;
  interest_outstanding?: number;
  fees_outstanding?: number;
  penalty_amount?: number;
  penalty_outstanding?: number;
  penalty?: number;
  total_outstanding?: number;
  principal_paid?: number;
  interest_paid?: number;
  fees_paid?: number;
  interest_amount?: number;
  total_fees?: number;
  status?: string;
  days_in_arrears?: number;
  repayment_count?: number;
  installment_amount?: number;
};

export type PaymentAllocationInput = {
  id?: string;
  amount?: number;
  /** Prefer allocated fields; API may send `*_amount` aliases. */
  principal_allocated?: number;
  interest_allocated?: number;
  fees_allocated?: number;
  penalty_allocated?: number;
  principal_amount?: number;
  interest_amount?: number;
  fees_amount?: number;
  penalty_amount?: number;
  status?: string;
  ledger_status?: string;
};

export type LoanRepaymentTruth = {
  contractualTotal: number;
  contractualPaid: number;
  contractualOutstanding: number;
  contractualProgress: number;
  principal: number;
  principalPaid: number;
  principalOutstanding: number;
  interestPaid: number;
  interestOutstanding: number;
  feesPaid: number;
  feesOutstanding: number;
  penaltiesCharged: number;
  penaltiesPaid: number;
  penaltyOutstanding: number;
  totalOutstanding: number;
  isPaidOff: boolean;
  /** True when status says paid_off but outstanding remains (or vice versa). */
  dataRequiresReview: boolean;
  displayStatus: "Paid off" | "Data requires review" | "In arrears" | "Active" | string;
  daysInArrears: number;
};

export type CustomerPaymentAllocationSummary = {
  cashReceived: number;
  appliedToContract: number;
  penaltiesPaid: number;
  paymentsUnavailable: boolean;
};

export const CONTRACT_PROGRESS_TOOLTIP =
  "Contract progress excludes penalties and shows how much of principal, interest and fees has been settled.";

export function money(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function isSettledPayment(payment: PaymentAllocationInput): boolean {
  const status = String(payment.status ?? "").toLowerCase().trim();
  if (status === "failed" || status === "reversed" || status === "pending" || status === "cancelled") {
    return false;
  }
  const ledger = String(payment.ledger_status ?? "").toLowerCase().trim();
  if (ledger === "reversed" || ledger === "failed" || ledger === "pending") {
    return false;
  }
  return (
    !status ||
    status === "completed" ||
    status === "verified" ||
    status === "paid" ||
    status === "success" ||
    ledger === "verified" ||
    ledger === "posted"
  );
}

export function resolveLoanDisplayStatus(loan: LoanRepaymentTruthInput): {
  label: LoanRepaymentTruth["displayStatus"];
  dataRequiresReview: boolean;
  isPaidOff: boolean;
} {
  const status = String(loan.status ?? "").toLowerCase().trim();
  const totalOutstanding = money(loan.total_outstanding);
  const isPaidOff = status === "paid_off" && totalOutstanding <= 0.01;

  if (isPaidOff) {
    return { label: "Paid off", dataRequiresReview: false, isPaidOff: true };
  }
  if (status === "paid_off" && totalOutstanding > 0.01) {
    return { label: "Data requires review", dataRequiresReview: true, isPaidOff: false };
  }
  if (totalOutstanding <= 0.01 && status !== "paid_off" && status !== "written_off" && status !== "cancelled") {
    // Outstanding cleared but backend status not paid_off — flag for review, do not invent completion.
    if (status === "active" || status === "in_arrears") {
      return { label: "Data requires review", dataRequiresReview: true, isPaidOff: false };
    }
  }
  if (status === "in_arrears") {
    return { label: "In arrears", dataRequiresReview: false, isPaidOff: false };
  }
  if (status === "active") {
    return { label: "Active", dataRequiresReview: false, isPaidOff: false };
  }
  if (!status) {
    return { label: "Active", dataRequiresReview: false, isPaidOff: false };
  }
  // Preserve other backend labels (written_off, cancelled, etc.) without inventing completion.
  const pretty = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: pretty, dataRequiresReview: false, isPaidOff: false };
}

/**
 * Contractual progress from backend outstanding buckets.
 * Never uses gross cash received (which includes penalties).
 */
export function resolveLoanRepaymentTruth(loan: LoanRepaymentTruthInput): LoanRepaymentTruth {
  const contractualTotal = money(
    loan.total_repayment != null && money(loan.total_repayment) > 0
      ? loan.total_repayment
      : loan.total_amount
  );
  const principal = money(loan.principal_amount ?? loan.principal);
  const principalOutstanding = money(loan.principal_outstanding);
  const interestOutstanding = money(loan.interest_outstanding);
  const feesOutstanding = money(loan.fees_outstanding);
  const penaltyOutstanding = money(
    loan.penalty_outstanding != null ? loan.penalty_outstanding : loan.penalty
  );

  const contractualOutstanding =
    principalOutstanding + interestOutstanding + feesOutstanding;

  const contractualPaid = Math.max(0, contractualTotal - contractualOutstanding);

  const rawProgress =
    contractualTotal > 0 ? clampPercent((contractualPaid / contractualTotal) * 100) : 0;

  const { label, dataRequiresReview, isPaidOff } = resolveLoanDisplayStatus(loan);
  const totalOutstanding = money(loan.total_outstanding);
  const penaltiesCharged = money(loan.penalty_amount);
  const penaltiesPaid = Math.max(0, penaltiesCharged - penaltyOutstanding);

  const principalPaid =
    loan.principal_paid != null && Number.isFinite(Number(loan.principal_paid))
      ? money(loan.principal_paid)
      : Math.max(0, principal - principalOutstanding);
  const interestPaid =
    loan.interest_paid != null && Number.isFinite(Number(loan.interest_paid))
      ? money(loan.interest_paid)
      : Math.max(0, money(loan.interest_amount) - interestOutstanding);
  const feesPaid =
    loan.fees_paid != null && Number.isFinite(Number(loan.fees_paid))
      ? money(loan.fees_paid)
      : Math.max(0, money(loan.total_fees) - feesOutstanding);

  return {
    contractualTotal,
    contractualPaid,
    contractualOutstanding,
    contractualProgress: isPaidOff ? 100 : Math.min(rawProgress, 99.99),
    principal,
    principalPaid,
    principalOutstanding,
    interestPaid,
    interestOutstanding,
    feesPaid,
    feesOutstanding,
    penaltiesCharged,
    penaltiesPaid,
    penaltyOutstanding,
    totalOutstanding,
    isPaidOff,
    dataRequiresReview,
    displayStatus: label,
    daysInArrears: money(loan.days_in_arrears),
  };
}

export function summarizeCustomerPaymentAllocations(
  payments: PaymentAllocationInput[] | null | undefined
): CustomerPaymentAllocationSummary {
  if (payments == null) {
    return {
      cashReceived: 0,
      appliedToContract: 0,
      penaltiesPaid: 0,
      paymentsUnavailable: true,
    };
  }

  let cashReceived = 0;
  let appliedToContract = 0;
  let penaltiesPaid = 0;

  for (const payment of payments) {
    if (!isSettledPayment(payment)) continue;
    const amount = money(payment.amount);
    if (amount > 0) cashReceived += amount;

    const principal = money(payment.principal_allocated ?? payment.principal_amount);
    const interest = money(payment.interest_allocated ?? payment.interest_amount);
    const fees = money(payment.fees_allocated ?? payment.fees_amount);
    const penalty = money(payment.penalty_allocated ?? payment.penalty_amount);

    appliedToContract += principal + interest + fees;
    if (penalty > 0) penaltiesPaid += penalty;
  }

  return {
    cashReceived,
    appliedToContract,
    penaltiesPaid,
    paymentsUnavailable: false,
  };
}

export function summarizeCustomerLoanTruth(loans: LoanRepaymentTruthInput[]) {
  let totalBorrowed = 0;
  let totalOutstanding = 0;
  let penaltiesCharged = 0;
  let penaltiesPaid = 0;
  let penaltiesOutstanding = 0;
  let appliedToContractFromLoans = 0;
  let completedLoans = 0;

  for (const loan of loans) {
    const truth = resolveLoanRepaymentTruth(loan);
    totalBorrowed += truth.principal;
    totalOutstanding += truth.totalOutstanding;
    penaltiesCharged += truth.penaltiesCharged;
    penaltiesPaid += truth.penaltiesPaid;
    penaltiesOutstanding += truth.penaltyOutstanding;
    appliedToContractFromLoans += truth.contractualPaid;
    if (truth.isPaidOff) completedLoans += 1;
  }

  return {
    totalBorrowed,
    totalOutstanding,
    penaltiesCharged,
    penaltiesPaid,
    penaltiesOutstanding,
    appliedToContractFromLoans,
    completedLoans,
  };
}

/** Schedule row: contractual installment separate from penalties. */
export function resolveScheduleInstallmentTruth(row: {
  principal_due?: number;
  interest_due?: number;
  fees_due?: number;
  total_due?: number;
  principal_paid?: number;
  interest_paid?: number;
  fees_paid?: number;
  total_paid?: number;
  penalty_due?: number;
  penalty_paid?: number;
  penalty_outstanding?: number;
  balance_due?: number;
  balance?: number;
}) {
  const contractualInstallment = money(
    row.total_due != null && money(row.total_due) > 0
      ? row.total_due
      : money(row.principal_due) + money(row.interest_due) + money(row.fees_due)
  );
  const contractualPaid = money(
    row.principal_paid != null || row.interest_paid != null || row.fees_paid != null
      ? money(row.principal_paid) + money(row.interest_paid) + money(row.fees_paid)
      : // Prefer not treating total_paid as contractual when it may include penalties —
        // use principal+interest+fees paid when present; otherwise clamp total_paid to installment.
        Math.min(money(row.total_paid), contractualInstallment)
  );
  const contractualOutstanding = Math.max(0, contractualInstallment - contractualPaid);
  const penaltyCharged = money(row.penalty_due);
  const penaltyPaid = money(row.penalty_paid);
  const penaltyOutstanding = money(
    row.penalty_outstanding != null
      ? row.penalty_outstanding
      : Math.max(0, penaltyCharged - penaltyPaid)
  );
  const totalCurrentlyDue =
    money(row.balance_due ?? row.balance) > 0
      ? money(row.balance_due ?? row.balance)
      : contractualOutstanding + penaltyOutstanding;

  return {
    contractualInstallment,
    contractualPaid,
    contractualOutstanding,
    penaltyCharged,
    penaltyPaid,
    penaltyOutstanding,
    totalCurrentlyDue,
  };
}
