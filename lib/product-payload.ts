/**
 * Build `POST /products` body per `backend-documentation/loan-products-controller.md`.
 */
export function buildProductCreateApiBody(input: Record<string, unknown>): Record<string, unknown> {
 const name = String(input.name ?? "").trim();
 const code = String(input.code ?? "").trim().toUpperCase().replace(/\s+/g, "-");

 const min_amount = Math.max(0, Math.round(Number(input.min_amount ?? 0)));
 const max_amount = Math.max(0, Math.round(Number(input.max_amount ?? 0)));
 const min_term_days = Math.max(0, Math.round(Number(input.min_term_days ?? 0)));
 const max_term_days = Math.max(0, Math.round(Number(input.max_term_days ?? 0)));

 const interest_typeRaw = String(input.interest_type ?? "flat").toLowerCase();
 const interest_type = interest_typeRaw === "reducing_balance" ? "reducing_balance" : "flat";

 const interest_rate_per_month = Math.min(
 100,
 Math.max(0, Number(input.interest_rate_per_month ?? 0))
 );

 const processing_fee_percent = Math.min(100, Math.max(0, Number(input.processing_fee_percent ?? 0)));
 const insurance_fee_percent = Math.min(100, Math.max(0, Number(input.insurance_fee_percent ?? 0)));

 const repayment_frequencyRaw = String(input.repayment_frequency ?? "monthly").toLowerCase();
 const repayment_frequency = ["daily", "weekly", "bi_weekly", "monthly"].includes(repayment_frequencyRaw)
 ? repayment_frequencyRaw
 : "monthly";

 const grace_period_days = Math.max(0, Math.round(Number(input.grace_period_days ?? 0)));

 let required_documents: string[] = [];
 if (Array.isArray(input.required_documents)) {
 required_documents = (input.required_documents as unknown[]).map((x) => String(x).trim()).filter(Boolean);
 } else if (typeof input.required_documents_csv === "string") {
 required_documents = input.required_documents_csv
 .split(/[,;\n]+/)
 .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
 .filter(Boolean);
 }

 let allowed_risk_grades: string[] = [];
 if (Array.isArray(input.allowed_risk_grades)) {
 allowed_risk_grades = (input.allowed_risk_grades as unknown[])
 .map((x) => String(x).trim().toUpperCase())
 .filter((g) => ["A", "B", "C", "D"].includes(g));
 }

 const is_active = input.is_active !== false;

 return {
 name,
 code,
 min_amount,
 max_amount,
 min_term_days,
 max_term_days,
 interest_type,
 interest_rate_per_month,
 processing_fee_percent,
 insurance_fee_percent,
 repayment_frequency,
 grace_period_days,
 required_documents,
 allowed_risk_grades,
 is_active,
 };
}
