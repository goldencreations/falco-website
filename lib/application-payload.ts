import type { CustomerIdType } from "@/lib/customer-id-types";
import { normalizeCustomerIdType } from "@/lib/customer-id-types";
import type { LoanMode, LoanProduct, RepaymentFrequency } from "@/lib/types";

export type ApplicationFormInput = {
 customer_id: string;
 product_id: string;
 loan_mode: LoanMode;
 group_id?: string | null;
 requested_amount: number;
 term_days: number;
 purpose: string;
 repayment_frequency: RepaymentFrequency;
 collaterals: Array<{ type: string; description: string; estimated_value: number }>;
 guarantors: Array<{
  full_name: string;
  phone: string;
  relationship: string;
  national_id?: string;
  id_type?: CustomerIdType;
  address?: string;
  collateral_type?: string;
  collateral_description?: string;
  collateral_estimated_value?: number;
 }>;
 references: Array<{ full_name: string; relationship: string; phone: string }>;
 location?: { latitude: string; longitude: string; captured_at: string };
};

const APPLICATION_REPAYMENT_FREQUENCIES: RepaymentFrequency[] = [
 "daily",
 "weekly",
 "monthly",
];

export function normalizeApplicationRepaymentFrequency(
 value: unknown,
 fallback: RepaymentFrequency = "weekly"
): RepaymentFrequency {
 const raw = String(value ?? "")
  .trim()
  .toLowerCase();
 if (raw === "daily" || raw === "weekly" || raw === "monthly") return raw;
 if (raw === "bi_weekly") return "weekly";
 return fallback;
}

/** Map UI form → Falco `POST/PATCH /applications` body (`loan-applications-controller.md`). */
export function mapApplicationFormToFalcoBody(input: ApplicationFormInput): Record<string, unknown> {
 const body: Record<string, unknown> = {
 customer_id: input.customer_id,
 product_id: input.product_id,
 loan_mode: input.loan_mode,
 requested_amount: input.requested_amount,
 term_days: input.term_days,
 purpose: input.purpose.trim() || "Working capital",
 repayment_frequency: normalizeApplicationRepaymentFrequency(input.repayment_frequency),
 };

 if (input.group_id) {
 body.group_id = input.group_id;
 }

 const collaterals = input.collaterals
 .filter((c) => c.type.trim())
 .map((c) => ({
 type: c.type.trim(),
 description: c.description.trim() || c.type.trim(),
 estimated_value: c.estimated_value > 0 ? c.estimated_value : 0,
 }));

 const guarantors = input.guarantors
 .filter((g) => g.full_name.trim() && g.phone.trim() && g.relationship.trim())
 .map((g) => {
 const row: Record<string, unknown> = {
 full_name: g.full_name.trim(),
 phone: g.phone.replace(/\s+/g, ""),
 relationship: g.relationship.trim(),
 };
 if (g.national_id?.trim()) row.national_id = g.national_id.trim();
 if (g.id_type) row.id_type = normalizeCustomerIdType(g.id_type);
 if (g.address?.trim()) row.address = g.address.trim();
 if (g.collateral_type?.trim()) row.collateral_type = g.collateral_type.trim();
 if (g.collateral_description?.trim()) row.collateral_description = g.collateral_description.trim();
 if (g.collateral_estimated_value != null && g.collateral_estimated_value > 0) {
 row.collateral_estimated_value = g.collateral_estimated_value;
 }
 return row;
 });

 const references = input.references
 .filter((r) => r.full_name.trim())
 .map((r) => ({
 full_name: r.full_name.trim(),
 relationship: r.relationship.trim() || "reference",
 phone: r.phone.replace(/\s+/g, "") || r.phone.trim(),
 }));

 if (collaterals.length > 0) body.collaterals = collaterals;
 if (guarantors.length > 0) body.guarantors = guarantors;
 if (references.length > 0) body.references = references;
 if (input.location?.latitude && input.location?.longitude) {
 body.location = input.location;
 }

 return body;
}

export function validateApplicationAgainstProduct(
 amount: number,
 termDays: number,
 product: LoanProduct
): string | null {
 if (amount < product.min_amount || amount > product.max_amount) {
 return `Amount must be between ${product.min_amount.toLocaleString()} and ${product.max_amount.toLocaleString()} TZS for this product.`;
 }
 if (termDays < product.min_term_days || termDays > product.max_term_days) {
 return `Term must be between ${product.min_term_days} and ${product.max_term_days} days for this product.`;
 }
 return null;
}

const ALLOWED_APPLICATION_KEYS = new Set([
 "customer_id",
 "product_id",
 "loan_mode",
 "group_id",
 "requested_amount",
 "term_days",
 "purpose",
 "repayment_frequency",
 "collaterals",
 "guarantors",
 "references",
 "location",
 "metadata",
]);

export { APPLICATION_REPAYMENT_FREQUENCIES };

/** Strip UI-only fields (`metadata`, `branch_id`, `is_draft`, …) before proxying to Falco. */
export function sanitizeApplicationBodyFromClient(
 body: Record<string, unknown>
): Record<string, unknown> {
 const out: Record<string, unknown> = {};
 for (const key of ALLOWED_APPLICATION_KEYS) {
 if (body[key] !== undefined) out[key] = body[key];
 }
 return out;
}
