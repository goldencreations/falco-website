import type { InterestType, LoanProduct, RepaymentFrequency, RiskGrade } from "@/lib/types";

function normalizeBoolean(value: unknown, defaultValue = true): boolean {
 if (value === null || value === undefined) return defaultValue;
 if (typeof value === "boolean") return value;
 if (typeof value === "number") return value !== 0;
 if (typeof value === "string") {
 const v = value.trim().toLowerCase();
 if (v === "true" || v === "1" || v === "yes") return true;
 if (v === "false" || v === "0" || v === "no") return false;
 }
 return defaultValue;
}

function asInterestType(v: string | undefined): InterestType {
 return v === "reducing_balance" ? "reducing_balance" : "flat";
}

function asRepaymentFrequency(v: string | undefined): RepaymentFrequency {
 if (v === "weekly" || v === "daily" || v === "bi_weekly" || v === "monthly") return v;
 return "monthly";
}

function asRiskGrades(v: unknown): RiskGrade[] {
 const all: RiskGrade[] = ["A", "B", "C", "D", "E"];
 if (!Array.isArray(v)) return all;
 const mapped = (v as unknown[])
 .map((x) => String(x).trim().toUpperCase())
 .filter((x): x is RiskGrade => (["A", "B", "C", "D", "E"] as string[]).includes(x));
 /* API may send lowercase or unknown entries; empty after filter would block every customer. */
 return mapped.length > 0 ? mapped : all;
}

export function adaptApiProductRow(row: Record<string, unknown>): LoanProduct {
 const ratePerMonthRaw =
 row.interest_rate_per_month != null && row.interest_rate_per_month !== ""
 ? Number(row.interest_rate_per_month)
 : NaN;
 const ratePerMonth = Number.isFinite(ratePerMonthRaw) ? ratePerMonthRaw : 0;
 const annualFromMonthly = ratePerMonth > 0 ? ratePerMonth * 12 : Number(row.interest_rate ?? 0);

 return {
 id: String(row.id ?? ""),
 name: String(row.name ?? ""),
 code: String(row.code ?? ""),
 description: String(row.description ?? ""),
 min_amount: Number(row.min_amount ?? 0),
 max_amount: Number(row.max_amount ?? 0),
 min_term_days: Number(row.min_term_days ?? 30),
 max_term_days: Number(row.max_term_days ?? 365),
 interest_rate: annualFromMonthly,
 interest_rate_per_month: ratePerMonth > 0 ? ratePerMonth : undefined,
 interest_type: asInterestType(row.interest_type ? String(row.interest_type) : undefined),
 processing_fee_percent: Number(row.processing_fee_percent ?? 0),
 insurance_fee_percent: Number(row.insurance_fee_percent ?? 0),
 late_payment_fee_percent: Number(row.late_payment_fee_percent ?? 0),
 min_credit_score: row.min_credit_score != null ? Number(row.min_credit_score) : undefined,
 required_documents: Array.isArray(row.required_documents)
 ? (row.required_documents as string[])
 : [],
 allowed_risk_grades: asRiskGrades(row.allowed_risk_grades),
 repayment_frequency: asRepaymentFrequency(
 row.repayment_frequency ? String(row.repayment_frequency) : undefined
 ),
 grace_period_days: Number(row.grace_period_days ?? 0),
 is_active: normalizeBoolean(row.is_active, true),
 created_at: String(row.created_at ?? new Date().toISOString()),
 };
}

function collectProductRows(json: unknown): Record<string, unknown>[] {
 if (Array.isArray(json)) {
 return json.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
 }
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 for (const key of ["data", "products", "items"]) {
 const candidate = o[key];
 if (Array.isArray(candidate)) {
 return candidate.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
 }
 }
 return [];
}

export function extractProductsList(json: unknown): LoanProduct[] {
 return collectProductRows(json)
 .map(adaptApiProductRow)
 .filter((product) => Boolean(product.id && product.name));
}

/** `GET/POST /products` detail envelope may use `{ product: {...} }` or a bare product object. */
export function extractProductDetail(json: unknown): Record<string, unknown> | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 if (o.product && typeof o.product === "object") {
 return o.product as Record<string, unknown>;
 }
 if ("id" in o && (typeof o.id === "string" || typeof o.id === "number")) {
 return o as Record<string, unknown>;
 }
 return null;
}
