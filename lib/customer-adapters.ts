import { parseMoneyInput } from "@/lib/money-input";
import { parseCustomerMetadata, readCustomerLocationPins } from "@/lib/customer-location";
import { parseCustomerGuarantorsFromRow } from "@/lib/customer-guarantors";
import { parseCustomerReferencesFromRow } from "@/lib/customer-references";
import {
  extractPassportPhotoPreviewUrl,
  extractPassportPhotoUrl,
} from "@/lib/customer-profile-extras";
import type { Customer, CustomerType, EmploymentType, RiskGrade } from "@/lib/types";

function isPlaceholderCustomerNamePart(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return true;
  if (v === "—" || v === "-" || v === "Unassigned") return true;
  if (/^member$/i.test(v)) return true;
  return false;
}

/** Display name from customer registration (rejects placeholders like "Member"). */
export function customerRegistrationDisplayName(
  customer: Pick<Customer, "first_name" | "middle_name" | "last_name" | "customer_number"> & {
    full_name?: string;
  }
): string {
  const full = customer.full_name?.trim();
  if (full && !isPlaceholderCustomerNamePart(full)) return full;

  const parts = [customer.first_name, customer.middle_name, customer.last_name].filter(
    (part) => !isPlaceholderCustomerNamePart(part)
  );
  const combined = parts.join(" ").replace(/\s+/g, " ").trim();
  if (combined) return combined;

  const number = customer.customer_number?.trim();
  if (number) return number;
  return "";
}

export function customerRegistrationDisplayNameFromRow(row: Record<string, unknown>): string {
  const full = String(row.full_name ?? row.name ?? "").trim();
  if (full && !isPlaceholderCustomerNamePart(full)) return full;

  const parts = [row.first_name, row.middle_name, row.last_name]
    .map((part) => String(part ?? "").trim())
    .filter((part) => !isPlaceholderCustomerNamePart(part));
  const combined = parts.join(" ").replace(/\s+/g, " ").trim();
  if (combined) return combined;

  const number = String(row.customer_number ?? "").trim();
  if (number) return number;
  return "";
}

/** Resolve monthly income from API list/detail shapes (top-level or metadata). */
export function resolveMonthlyIncome(row: Record<string, unknown>): number {
 const md =
 row.metadata && typeof row.metadata === "object" && row.metadata !== null
 ? (row.metadata as Record<string, unknown>)
 : {};

 const candidates = [row.monthly_income, row.monthlyIncome, md.monthly_income, md.monthlyIncome];

 for (const v of candidates) {
 if (v == null || v === "") continue;
 const n = typeof v === "number" ? v : parseMoneyInput(String(v));
 if (Number.isFinite(n) && n > 0) return n;
 }
 return 0;
}

function asRiskGrade(v: string | undefined): RiskGrade {
 const u = v?.trim().toUpperCase();
 if (u === "A" || u === "B" || u === "C" || u === "D" || u === "E") return u;
 return "B";
}

function nestedUserId(value: unknown): string {
 if (!value || typeof value !== "object") return "";
 const id = (value as Record<string, unknown>).id;
 return id != null ? String(id).trim() : "";
}

/** Resolve relationship manager / loan officer id from list or detail API shapes. */
export function resolveCustomerLoanOfficerId(row: Record<string, unknown>): string {
 const md =
 row.metadata && typeof row.metadata === "object" && row.metadata !== null
 ? (row.metadata as Record<string, unknown>)
 : {};

 const flat = [
 row.assigned_loan_officer_id,
 row.loan_officer_id,
 row.relationship_manager_id,
 md.loan_officer_id,
 md.assigned_loan_officer_id,
 md.relationship_manager_id,
 ];

 for (const v of flat) {
 const s = v != null ? String(v).trim() : "";
 if (s) return s;
 }

 const nested = nestedUserId(row.loan_officer);
 if (nested) return nested;
 const rm = nestedUserId(row.relationship_manager);
 if (rm) return rm;
 const assigned = nestedUserId(row.assigned_officer);
 if (assigned) return assigned;

 return "";
}

function resolveCustomerCreatedBy(row: Record<string, unknown>): string {
 const md =
 row.metadata && typeof row.metadata === "object" && row.metadata !== null
 ? (row.metadata as Record<string, unknown>)
 : {};
 if (md.created_by != null && String(md.created_by).trim()) return String(md.created_by).trim();
 if (row.created_by != null && String(row.created_by).trim()) return String(row.created_by).trim();
 const nested = nestedUserId(row.creator ?? row.created_by_user);
 return nested;
}

/** Maps API list/detail customer row into the richer `Customer` UI model (defaults for unknown fields). */
export function adaptApiCustomerRowToCustomer(row: Record<string, unknown>): Customer {
 const md = parseCustomerMetadata(row);

 const full = String(row.full_name ?? row.name ?? "").trim();
 const parts = full.split(/\s+/).filter(Boolean);
 const rawFirst = String(row.first_name ?? "").trim();
 const rawLast = String(row.last_name ?? "").trim();
 const first =
 !isPlaceholderCustomerNamePart(rawFirst)
 ? rawFirst
 : parts[0] && !isPlaceholderCustomerNamePart(parts[0])
 ? parts[0]
 : "—";
 const last =
 !isPlaceholderCustomerNamePart(rawLast)
 ? rawLast
 : parts.length > 1
 ? parts.slice(1).join(" ")
 : "—";

 const { home, business } = readCustomerLocationPins(row);

 return {
 id: String(row.id ?? ""),
 customer_number: String(row.customer_number ?? ""),
 customer_type: (String(row.customer_type ?? "individual") as CustomerType) || "individual",
 first_name: first,
 middle_name: row.middle_name ? String(row.middle_name) : undefined,
 last_name: last,
 date_of_birth: String(row.date_of_birth ?? "1990-01-01"),
 gender: row.gender === "female" ? "female" : "male",
 national_id: String(row.national_id ?? ""),
 passport_number: row.passport_number ? String(row.passport_number) : undefined,
 phone_primary: String(row.phone_number ?? row.phone_primary ?? ""),
 phone_secondary: row.alternate_phone ? String(row.alternate_phone) : undefined,
 email: row.email ? String(row.email) : undefined,
 physical_address: String(row.physical_address ?? ""),
 region: String(row.region ?? ""),
 district: String(row.district ?? ""),
 ward: String(row.ward ?? ""),
 home_latitude: home?.latitude ?? null,
 home_longitude: home?.longitude ?? null,
 business_latitude: business?.latitude ?? null,
 business_longitude: business?.longitude ?? null,
 guarantors: parseCustomerGuarantorsFromRow(row),
 references: parseCustomerReferencesFromRow(row),
 employment_type: (String(row.employment_type ?? "employed") as EmploymentType) || "employed",
 employer_name: row.employer_name ? String(row.employer_name) : undefined,
 employer_address: row.employer_address ? String(row.employer_address) : undefined,
 job_title: row.job_title ? String(row.job_title) : undefined,
 monthly_income: resolveMonthlyIncome(row),
 other_income:
 row.other_income != null
 ? Number(row.other_income)
 : md.other_income != null
 ? Number(md.other_income)
 : undefined,
 income_verified: Boolean(row.income_verified ?? false),
 business_name: row.business_name
  ? String(row.business_name)
  : md.business_name
    ? String(md.business_name)
    : undefined,
 business_registration_number: row.business_registration_number
  ? String(row.business_registration_number)
  : undefined,
 business_type: row.business_type ? String(row.business_type) : undefined,
 business_address:
  row.business_address != null && String(row.business_address).trim()
   ? String(row.business_address).trim()
   : md.business_address != null && String(md.business_address).trim()
     ? String(md.business_address).trim()
     : undefined,
 years_in_business: row.years_in_business != null ? Number(row.years_in_business) : undefined,
 next_of_kin_name: String(row.next_of_kin_name ?? "—"),
 next_of_kin_relationship: String(row.next_of_kin_relationship ?? "—"),
 next_of_kin_phone: String(row.next_of_kin_phone ?? "—"),
 next_of_kin_address: String(row.next_of_kin_address ?? "—"),
 risk_grade: asRiskGrade(row.risk_grade ? String(row.risk_grade) : undefined),
 credit_score: row.credit_score != null ? Number(row.credit_score) : undefined,
 is_blacklisted: Boolean(row.is_blacklisted ?? false),
 blacklist_reason:
 row.blacklist_reason != null
 ? String(row.blacklist_reason)
 : md.blacklist_reason != null
 ? String(md.blacklist_reason)
 : undefined,
 branch_id: String(row.branch_id ?? ""),
 created_by: resolveCustomerCreatedBy(row),
 assigned_loan_officer_id: (() => {
 const id = resolveCustomerLoanOfficerId(row);
 return id || undefined;
 })(),
 passport_photo_url: extractPassportPhotoUrl(row),
 passport_photo_preview_url: extractPassportPhotoPreviewUrl(row),
 created_at: String(row.created_at ?? new Date().toISOString()),
 updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
 is_active: row.is_active !== false,
 };
}

export function extractCustomersList(json: unknown): Customer[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.customers) ? o.customers : [];
 if (!Array.isArray(rows)) return [];
 return (rows as Record<string, unknown>[]).map(adaptApiCustomerRowToCustomer);
}

/** `GET /customers/{id}` may return `{ customer: {...} }` or a bare customer object. */
export function extractCustomerDetail(json: unknown): Record<string, unknown> | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 if (o.customer && typeof o.customer === "object") {
 return o.customer as Record<string, unknown>;
 }
 if ("id" in o && (typeof o.id === "string" || typeof o.id === "number")) {
 return o as Record<string, unknown>;
 }
 return null;
}
