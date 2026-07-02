import { parseMoneyInput } from "@/lib/money-input";
import type { InterestType, LoanProduct, RepaymentFrequency } from "@/lib/types";

export type CalculatorScheduleRow = {
 installmentNumber: number;
 dueDate: string;
 principalDue?: number;
 interestDue?: number;
 feesDue?: number;
 totalDue: number;
};

export type CalculatorResultView = {
 principal: number;
 termDays?: number;
 loanPeriodMonths?: number;
 interestRate: number;
 interestType: InterestType;
 interestAmount: number;
 interestOnPrincipal?: number;
 interestOnProcessingFee?: number;
 processingFee: number;
 insuranceFee: number;
 totalFees: number;
 totalRepayment: number;
 installmentAmount: number;
 repaymentCount: number;
 repaymentFrequency: RepaymentFrequency;
 firstRepaymentDate?: string;
 /** Late-payment penalty from preview when returned by API (usually applied on overdue installments). */
 penaltyAmount?: number;
 schedulePreview: CalculatorScheduleRow[];
};

export type CalculatorProductDefaults = {
 product: LoanProduct;
};

function num(v: unknown, fallback = 0): number {
 const n = Number(v);
 return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
 if (v == null) return fallback;
 return String(v);
}

function asInterestType(v: string): InterestType {
 return v === "reducing_balance" ? "reducing_balance" : "flat";
}

function asRepaymentFrequency(v: string): RepaymentFrequency {
 if (v === "weekly" || v === "daily" || v === "bi_weekly" || v === "monthly") return v;
 return "monthly";
}

/** UI interest type → API preview body. */
export function uiInterestTypeToApi(interestType: string): string {
 if (interestType === "flat_interest") return "flat_interest";
 if (interestType === "declining_balance") return "declining_balance";
 if (interestType === "reducing_balance") return "reducing_balance";
 return "flat_interest";
}

/** API interest type → UI select value. */
export function apiInterestTypeToUi(interestType: string | undefined): string {
 if (interestType === "flat") return "flat_interest";
 if (interestType === "reducing_balance") return "declining_balance";
 return "declining_balance";
}

export function adaptCalculatorResult(raw: Record<string, unknown>): CalculatorResultView {
 const scheduleRaw = Array.isArray(raw.schedule_preview) ? raw.schedule_preview : [];
 return {
 principal: num(raw.principal),
 termDays: raw.term_days != null ? num(raw.term_days) : undefined,
 loanPeriodMonths: raw.loan_period_months != null ? num(raw.loan_period_months) : undefined,
 interestRate: num(raw.interest_rate),
 interestType: asInterestType(str(raw.interest_type, "flat")),
 interestAmount: num(raw.interest_amount),
 interestOnPrincipal:
  raw.interest_on_principal != null ? num(raw.interest_on_principal) : undefined,
 interestOnProcessingFee:
  raw.interest_on_processing_fee != null ? num(raw.interest_on_processing_fee) : undefined,
 processingFee: num(raw.processing_fee),
 insuranceFee: num(raw.insurance_fee),
 totalFees: num(raw.total_fees),
 totalRepayment: num(raw.total_repayment),
 installmentAmount: num(raw.installment_amount),
 repaymentCount: num(raw.repayment_count),
 repaymentFrequency: asRepaymentFrequency(str(raw.repayment_frequency, "monthly")),
 firstRepaymentDate: raw.first_repayment_date ? str(raw.first_repayment_date) : undefined,
 penaltyAmount:
  raw.penalty_amount != null
   ? num(raw.penalty_amount)
   : raw.penalty_fee != null
   ? num(raw.penalty_fee)
   : undefined,
 schedulePreview: scheduleRaw.map((row, index) => {
 const r = row as Record<string, unknown>;
 return {
 installmentNumber: num(r.installment_number, index + 1),
 dueDate: str(r.due_date),
 principalDue: r.principal_due != null ? num(r.principal_due) : undefined,
 interestDue: r.interest_due != null ? num(r.interest_due) : undefined,
 feesDue: r.fees_due != null ? num(r.fees_due) : undefined,
 totalDue: num(r.total_due),
 };
 }),
 };
}

export function extractCalculatorResult(json: unknown): CalculatorResultView | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const result = o.result;
 if (!result || typeof result !== "object") return null;
 return adaptCalculatorResult(result as Record<string, unknown>);
}

export function extractCalculatorProductDefaults(json: unknown): CalculatorProductDefaults | null {
 if (!json || typeof json !== "object") return null;
 const product = (json as Record<string, unknown>).product;
 if (!product || typeof product !== "object") return null;
 const p = product as Record<string, unknown>;
 const ratePerMonth = num(p.interest_rate_per_month);
 return {
 product: {
 id: str(p.id),
 name: str(p.name),
 code: str(p.code),
 description: "",
 min_amount: num(p.min_amount),
 max_amount: num(p.max_amount),
 min_term_days: num(p.min_term_days, 30),
 max_term_days: num(p.max_term_days, 365),
 interest_rate: ratePerMonth > 0 ? ratePerMonth * 12 : 0,
 interest_rate_per_month: ratePerMonth > 0 ? ratePerMonth : undefined,
 interest_type: asInterestType(str(p.interest_type)),
 processing_fee_percent: num(p.processing_fee_percent),
 insurance_fee_percent: num(p.insurance_fee_percent),
 late_payment_fee_percent: num(p.late_payment_fee_percent ?? p.penalty_percent ?? p.late_penalty_percent),
 required_documents: Array.isArray(p.required_documents) ? (p.required_documents as string[]) : [],
 allowed_risk_grades: Array.isArray(p.allowed_risk_grades)
 ? (p.allowed_risk_grades as string[]).map((g) => String(g).toUpperCase() as "A" | "B" | "C" | "D" | "E")
 : ["A", "B", "C", "D", "E"],
 repayment_frequency: asRepaymentFrequency(str(p.repayment_frequency, "monthly")),
 grace_period_days: num(p.grace_period_days),
 is_active: p.is_active !== false,
 created_at: str(p.created_at, new Date().toISOString()),
 },
 };
}

export type CalculatorPreviewForm = {
  mode: "product" | "manual";
  productId: string;
  principal: string;
  /** Product-backed preview — term in days (must be within product min/max). */
  termDays: string;
  loanPeriodMonths: string;
  repaymentFrequency: RepaymentFrequency;
  interestType: string;
  interestRatePerMonth: string;
  processingFeePercent: string;
  insuranceFeePercent: string;
  startDate: string;
};

/** API convention: loan_period_months × 30 when term_days is derived from months. */
export function termDaysFromLoanPeriodMonths(months: number): number {
  return Math.max(1, Math.round(months)) * 30;
}

/** Month range that stays within product term day bounds (30-day month convention). */
export function productTermMonthsRange(product: LoanProduct): {
  minMonths: number;
  maxMonths: number;
  monthsFitBounds: boolean;
} {
  const minMonths = Math.max(1, Math.ceil(product.min_term_days / 30));
  const maxMonths = Math.max(1, Math.floor(product.max_term_days / 30));
  return {
    minMonths,
    maxMonths,
    monthsFitBounds: minMonths <= maxMonths,
  };
}

export function validateProductCalculatorPreview(
  principal: number,
  termDays: number,
  product: LoanProduct
): string | null {
  if (principal < product.min_amount || principal > product.max_amount) {
    return `Principal Amount must be between ${product.min_amount.toLocaleString()} and ${product.max_amount.toLocaleString()} TZS for this product.`;
  }
  if (termDays < product.min_term_days || termDays > product.max_term_days) {
    return `Term must be between ${product.min_term_days} and ${product.max_term_days} days for this product.`;
  }
  return null;
}

/** Map UI form → `POST /calculator/preview` body. */
export function mapUiCalculatorPreviewToApi(
  form: CalculatorPreviewForm,
  product?: LoanProduct | null
): Record<string, unknown> | null {
  const principal = num(parseMoneyInput(form.principal));
  if (principal < 1) return null;

  const payload: Record<string, unknown> = { principal };

  if (form.startDate.trim()) payload.start_date = form.startDate.trim();

  if (form.mode === "product" && form.productId.trim()) {
    const termDays = Math.round(num(form.termDays));
    if (termDays < 1) return null;
    if (product) {
      const validationError = validateProductCalculatorPreview(principal, termDays, product);
      if (validationError) return null;
    }
    payload.product_id = Number(form.productId);
    payload.term_days = termDays;
    return payload;
  }

  const loanPeriodMonths = num(form.loanPeriodMonths);
  if (loanPeriodMonths < 1) return null;

  payload.loan_period_months = Math.round(loanPeriodMonths);
  payload.repayment_frequency = form.repaymentFrequency;
  payload.interest_type = uiInterestTypeToApi(form.interestType);
  payload.interest_rate_per_month = num(form.interestRatePerMonth);
  payload.processing_fee_percent = num(form.processingFeePercent);
  payload.insurance_fee_percent = num(form.insuranceFeePercent);

  return payload;
}

export function getProductCalculatorValidationError(
  form: CalculatorPreviewForm,
  product: LoanProduct | null | undefined
): string | null {
  if (form.mode !== "product" || !product) return null;
  const principal = num(parseMoneyInput(form.principal));
  if (principal < 1) return "Enter a Principal Amount to calculate.";
  const termDays = Math.round(num(form.termDays));
  if (termDays < 1) return "Enter a loan term in days.";
  return validateProductCalculatorPreview(principal, termDays, product);
}
