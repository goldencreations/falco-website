import type { InterestType, RepaymentFrequency } from "@/lib/types";

export type LoanFormulaInput = {
 principal: number;
 months: number;
 interestRatePerMonth: string | number;
 processingFeePercent: string | number;
 insuranceFeePercent: string | number;
 repaymentFrequency: RepaymentFrequency;
 interestType?: InterestType | string;
};

export type LoanFormulaResult = {
 principal: number;
 months: number;
 termDays: number;
 interestRate: number;
 processingFeePercent: number;
 insuranceFeePercent: number;
 processingFee: number;
 insuranceFee: number;
 interestOnPrincipal: number;
 interestOnProcessingFee: number;
 interestAmount: number;
 totalFees: number;
 totalRepayment: number;
 repaymentCount: number;
 installmentAmount: number;
 repaymentFrequency: RepaymentFrequency;
 interestType: InterestType;
};

export function normalizePercentInput(value: string | number): number {
 const numeric = Math.max(0, Number(value) || 0);
 return numeric > 100 ? numeric / 100 : numeric;
}

export function normalizeInsuranceInput(value: string | number): number {
 const numeric = Math.max(0, Number(value) || 0);
 if (numeric > 0 && numeric < 1) return numeric * 100;
 return normalizePercentInput(value);
}

export function repaymentCountForFormula(
 frequency: RepaymentFrequency,
 termDays: number,
 months: number
): number {
 if (frequency === "daily") return Math.max(1, termDays);
 if (frequency === "weekly") return Math.max(1, Math.round(months * 4));
 if (frequency === "bi_weekly") return Math.max(1, Math.round(months * 2));
 return Math.max(1, Math.round(months));
}

export function monthsFromTermDays(termDays: number): number {
 return Math.max(1, Math.round((Number(termDays) || 0) / 30));
}

export function calculateLoanFormula(input: LoanFormulaInput): LoanFormulaResult {
 const principal = Math.max(0, Number(input.principal) || 0);
 const months = Math.max(1, Math.round(Number(input.months) || 0));
 const termDays = months * 30;
 const interestRate = normalizePercentInput(input.interestRatePerMonth);
 const processingFeePercent = normalizePercentInput(input.processingFeePercent);
 const insuranceFeePercent = normalizeInsuranceInput(input.insuranceFeePercent);
 const repaymentFrequency = input.repaymentFrequency || "monthly";
 const interestType = input.interestType === "reducing_balance" ? "reducing_balance" : "flat";

 const processingFee = principal * (processingFeePercent / 100);
 const insuranceFee = principal * (insuranceFeePercent / 100);
 const interestOnPrincipal = principal * (interestRate / 100) * months;
 const interestOnProcessingFee = processingFee * (interestRate / 100) * months;
 const interestAmount = interestOnPrincipal + interestOnProcessingFee;
 const totalFees = processingFee + insuranceFee;
 const totalRepayment =
  principal + processingFee + interestOnProcessingFee + interestOnPrincipal + insuranceFee;
 const repaymentCount = repaymentCountForFormula(repaymentFrequency, termDays, months);
 const installmentAmount = totalRepayment / repaymentCount;

 return {
  principal,
  months,
  termDays,
  interestRate,
  processingFeePercent,
  insuranceFeePercent,
  processingFee,
  insuranceFee,
  interestOnPrincipal,
  interestOnProcessingFee,
  interestAmount,
  totalFees,
  totalRepayment,
  repaymentCount,
  installmentAmount,
  repaymentFrequency,
  interestType,
 };
}
