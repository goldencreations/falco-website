import type { RepaymentFrequency, RepaymentSchedule } from "@/lib/types";

export function parseDateOnly(value?: string | null): Date | null {
 if (!value || value === "1970-01-01") return null;
 const date = new Date(`${value.slice(0, 10)}T00:00:00`);
 return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOnly(date: Date): string {
 const y = date.getFullYear();
 const m = String(date.getMonth() + 1).padStart(2, "0");
 const d = String(date.getDate()).padStart(2, "0");
 return `${y}-${m}-${d}`;
}

export function repaymentIntervalDays(frequency: RepaymentFrequency): number {
 switch (frequency) {
 case "daily":
 return 1;
 case "weekly":
 return 7;
 case "bi_weekly":
 return 14;
 case "monthly":
 return 30;
 default:
 return 30;
 }
}

function addCalendarDays(date: Date, days: number): Date {
 const next = new Date(date.getTime());
 next.setDate(next.getDate() + days);
 return next;
}

type FirstPaymentInput = {
 /** Actual disbursement only — never loan `created_at`. */
 disbursement_date?: string | null;
 first_payment_date?: unknown;
 repayment_frequency: RepaymentFrequency;
};

/**
 * Resolve the first installment due date. The LMS sometimes omits this field,
 * echoes disbursement_date, or returns a date inside the first repayment period.
 */
export function resolveFirstPaymentDate(input: FirstPaymentInput): string {
 const disbursed = parseDateOnly(input.disbursement_date ?? undefined);
 const explicitRaw =
 input.first_payment_date != null && input.first_payment_date !== ""
 ? String(input.first_payment_date).slice(0, 10)
 : undefined;
 const explicit = parseDateOnly(explicitRaw);
 const interval = repaymentIntervalDays(input.repayment_frequency);

 if (disbursed) {
 const minDue = addCalendarDays(disbursed, interval);
 if (explicit && explicit.getTime() >= minDue.getTime()) {
 return explicitRaw!;
 }
 return formatDateOnly(minDue);
 }

 if (explicitRaw) return explicitRaw;
 return "1970-01-01";
}

/** Earliest unpaid installment from a materialized repayment schedule. */
export function nextDueDateFromSchedule(rows: RepaymentSchedule[]): string | undefined {
 const candidates = rows
 .filter((row) => {
 if (row.is_paid) return false;
 const balance = row.balance_due ?? row.balance ?? 0;
 return balance > 0 || !row.is_paid;
 })
 .map((row) => row.due_date?.slice(0, 10))
 .filter((value): value is string => Boolean(value && value !== "1970-01-01"))
 .sort();

 return candidates[0];
}

export function resolveLoanNextDueDate(loan: {
 next_due_date?: string;
 first_payment_date?: string;
}): string | undefined {
 const next = loan.next_due_date || loan.first_payment_date;
 if (!next || next === "1970-01-01") return undefined;
 return next;
}

export function daysUntilDate(value?: string): number | null {
 const due = parseDateOnly(value);
 if (!due) return null;
 const today = new Date();
 const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
 return Math.ceil((due.getTime() - current.getTime()) / 86_400_000);
}

export function earliestDueDate(
 loans: Array<{ next_due_date?: string; first_payment_date?: string }>
): string | undefined {
 const candidates = loans
 .map((loan) => resolveLoanNextDueDate(loan))
 .filter((value): value is string => Boolean(value))
 .sort();

 return candidates[0];
}
