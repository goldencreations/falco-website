import { parseMoneyInput } from "@/lib/money-input";
import type { Customer, EmploymentType } from "@/lib/types";

function employmentTypeToOccupationHint(et: EmploymentType): string {
 switch (et) {
 case "employed":
 return "employed";
 case "self_employed":
 return "self employed";
 case "business_owner":
 return "business owner";
 case "retired":
 return "retired";
 case "unemployed":
 return "unemployed";
 default:
 return "self employed";
 }
}

export function riskGradeToRiskLevel(grade: string): "low" | "medium" | "high" | "critical" {
 if (grade === "A") return "low";
 if (grade === "B") return "medium";
 if (grade === "C") return "high";
 return "critical";
}

/** Build the same shape as the create-customer form from a `Customer` plus optional raw API row (for metadata). */
export function customerToFormPayload(customer: Customer, rawRow?: Record<string, unknown> | null): Record<string, unknown> {
 const md =
 rawRow?.metadata && typeof rawRow.metadata === "object" && rawRow.metadata !== null
 ? (rawRow.metadata as Record<string, unknown>)
 : {};

 const paymentRef = md.payment_reference != null ? String(md.payment_reference) : "";
 const statusVal = md.status != null ? String(md.status) : "active";
 const businessAddress =
  customer.business_address?.trim() ||
  (rawRow?.business_address != null ? String(rawRow.business_address).trim() : "") ||
  (md.business_address != null ? String(md.business_address).trim() : "");

 return {
 first_name: customer.first_name,
 middle_name: customer.middle_name ?? "",
 last_name: customer.last_name,
 full_name: [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(" "),
 phone: customer.phone_primary,
 alt_phone: customer.phone_secondary ?? "",
 email: customer.email ?? "",
 physical_address: customer.physical_address,
 home_latitude: customer.home_latitude ?? null,
 home_longitude: customer.home_longitude ?? null,
 street: md.street != null ? String(md.street) : "",
 ward: customer.ward,
 district: customer.district,
 region: customer.region,
 national_id: customer.national_id,
 id_type: md.id_type != null ? String(md.id_type) : "NIDA",
 occupation: md.occupation != null ? String(md.occupation) : employmentTypeToOccupationHint(customer.employment_type),
 employer_name: customer.employer_name ?? "",
 employer_address: customer.employer_address ?? "",
 employer_phone: md.employer_phone != null ? String(md.employer_phone) : "",
 employment_start_date: md.employment_start_date != null ? String(md.employment_start_date) : "",
 monthly_income: String(customer.monthly_income ?? ""),
 business_name: customer.business_name ?? "",
 business_type: customer.business_type ?? "",
 business_address: businessAddress,
 business_latitude: customer.business_latitude ?? null,
 business_longitude: customer.business_longitude ?? null,
 business_registration_no: customer.business_registration_number ?? "",
 years_in_business: customer.years_in_business != null ? String(customer.years_in_business) : "",
 cheque_number: md.cheque_number != null ? String(md.cheque_number) : "",
 payment_reference: paymentRef || "—",
 registration_fee_paid: Boolean(md.registration_fee_paid),
 registration_fee_amount: md.registration_fee_amount != null ? String(md.registration_fee_amount) : "",
 registration_fee_paid_at: md.registration_fee_paid_at != null ? String(md.registration_fee_paid_at) : "",
 status: statusVal,
 risk_level: riskGradeToRiskLevel(customer.risk_grade),
 risk_score: customer.credit_score != null ? String(customer.credit_score) : "0",
 notes: md.notes != null ? String(md.notes) : "",
 branch_id: customer.branch_id,
 loan_officer_id: customer.assigned_loan_officer_id ?? "",
 created_by: customer.created_by,
 date_of_birth: customer.date_of_birth,
 gender: customer.gender,
 next_of_kin_name: customer.next_of_kin_name,
 next_of_kin_relationship: customer.next_of_kin_relationship,
 next_of_kin_phone: customer.next_of_kin_phone,
 next_of_kin_address: customer.next_of_kin_address,
 is_blacklisted: customer.is_blacklisted,
 blacklist_reason: customer.blacklist_reason ?? "",
 guarantors: customer.guarantors ?? [],
 references: customer.references ?? [],
 };
}

/**
 * Maps the create-customer form payload (used by the UI) to the Falco LMS
 * `POST /customers` body per `backend-documentation/customers-controller.md`.
 *
 * Notes:
 * - `risk_grade` must be `A` | `B` | `C` | `D` (docs; no `E`).
 * - `employment_type` must match LMS enums (see `lib/types` EmploymentType).
 * - Many APIs reject `null` for string columns; we use empty strings or omit where safe.
 */
export function mapFormPayloadToCustomerApi(input: Record<string, unknown>): Record<string, unknown> {
 const fn = String(input.first_name ?? "").trim();
 const ln = String(input.last_name ?? "").trim();
 const fullName = String(input.full_name ?? "").trim();
 const parts = fullName.split(/\s+/).filter(Boolean);
 const first_name = fn || (parts[0] ?? "Customer");
 const last_name = ln || (parts.length > 1 ? parts.slice(1).join(" ") : first_name);
 const middle_name = input.middle_name != null ? String(input.middle_name).trim() : "";

 const rawPhone = String(input.phone ?? "").trim();
 const digitsPhone = rawPhone.replace(/\D/g, "");
 /** Prefer E.164-style without `+` as in docs (`255712345678`). */
 let phone_number = digitsPhone;
 if (phone_number.startsWith("0") && phone_number.length >= 9) {
 phone_number = `255${phone_number.slice(1)}`;
 } else if (phone_number && !phone_number.startsWith("255") && phone_number.length >= 9) {
 phone_number = `255${phone_number}`;
 }

 const altRaw = input.alt_phone ? String(input.alt_phone).trim() : "";
 const altDigits = altRaw.replace(/\D/g, "");
 let alternate_phone: string | undefined = altDigits || undefined;
 if (alternate_phone?.startsWith("0") && alternate_phone.length >= 9) {
 alternate_phone = `255${alternate_phone.slice(1)}`;
 } else if (alternate_phone && !alternate_phone.startsWith("255") && alternate_phone.length >= 9) {
 alternate_phone = `255${alternate_phone}`;
 }

 const riskLevel = String(input.risk_level ?? "medium").toLowerCase();
 const risk_grade =
 riskLevel === "low" ? "A" : riskLevel === "medium" ? "B" : riskLevel === "high" ? "C" : "D";

 const monthlyRaw =
 input.monthly_income != null && input.monthly_income !== ""
 ? typeof input.monthly_income === "number"
 ? input.monthly_income
 : parseMoneyInput(String(input.monthly_income))
 : NaN;
 const monthly_income = Number.isFinite(monthlyRaw) && monthlyRaw > 0 ? monthlyRaw : 1;

 const businessName = input.business_name ? String(input.business_name).trim() : "";
 const customer_type = businessName ? "business" : "individual";

 const occ = String(input.occupation ?? "").toLowerCase();
 let employment_type: "employed" | "self_employed" | "business_owner" | "retired" | "unemployed" = "self_employed";
 if (customer_type === "business") {
 employment_type = "business_owner";
 } else if (occ.includes("unemploy")) {
 employment_type = "unemployed";
 } else if (occ.includes("retir")) {
 employment_type = "retired";
 } else if (occ.includes("self") || occ.includes("freelance") || occ.includes("boda") || occ.includes("vendor")) {
 employment_type = "self_employed";
 } else if (occ.includes("employ") || occ.includes("staff") || occ.includes("officer")) {
 employment_type = "employed";
 }

 const scoreRaw = input.risk_score != null && input.risk_score !== "" ? Number(input.risk_score) : NaN;
 const creditFromRisk = Number.isFinite(scoreRaw) ? Math.min(999, Math.max(0, Math.round(scoreRaw))) : null;
 const creditFromInput =
 input.credit_score != null && input.credit_score !== ""
 ? Math.min(999, Math.max(0, Math.round(Number(input.credit_score))))
 : NaN;
 const credit_score = Number.isFinite(creditFromInput) ? creditFromInput : creditFromRisk;

 const dobRaw = input.date_of_birth ? String(input.date_of_birth).trim() : "";
 const date_of_birth = dobRaw.length >= 8 ? dobRaw : "1995-01-01";

 const genderIn = String(input.gender ?? "").toLowerCase();
 const gender = genderIn === "male" ? "male" : "female";

 const nokName = input.next_of_kin_name != null ? String(input.next_of_kin_name).trim() : "";
 const nokRel = input.next_of_kin_relationship != null ? String(input.next_of_kin_relationship).trim() : "";
 const nokPhone = input.next_of_kin_phone != null ? String(input.next_of_kin_phone).trim() : "";
 const nokAddr = input.next_of_kin_address != null ? String(input.next_of_kin_address).trim() : "";

 const is_blacklisted = typeof input.is_blacklisted === "boolean" ? input.is_blacklisted : false;

 const emailTrim = input.email ? String(input.email).trim() : "";
 const email = emailTrim.length > 0 ? emailTrim : undefined;

 const guarantors = Array.isArray(input.guarantors)
  ? (input.guarantors as Array<Record<string, unknown>>)
      .map((row) => {
        const full_name = String(row.full_name ?? row.name ?? "").trim();
        const phone =
          String(row.phone ?? row.phone_number ?? "").replace(/\D/g, "") ||
          String(row.phone ?? "").trim();
        const relationship = String(row.relationship ?? "").trim();
        if (!full_name || !phone || !relationship) return null;

        const id = row.id != null ? String(row.id).trim() : "";
        const national_id = row.national_id != null ? String(row.national_id).trim() : "";
        const id_front_document_id =
          row.id_front_document_id != null ? String(row.id_front_document_id).trim() : "";
        const id_back_document_id =
          row.id_back_document_id != null ? String(row.id_back_document_id).trim() : "";

        return {
          ...(id ? { id } : {}),
          full_name,
          phone,
          relationship,
          ...(national_id ? { national_id } : {}),
          attachments: [] as [],
          ...(id_front_document_id ? { id_front_document_id } : {}),
          ...(id_back_document_id ? { id_back_document_id } : {}),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
  : [];

 const references = Array.isArray(input.references)
  ? (input.references as Array<Record<string, unknown>>)
      .map((row) => ({
        full_name: String(row.full_name ?? row.name ?? "").trim(),
        phone: String(row.phone ?? row.phone_number ?? "").replace(/\D/g, "") || String(row.phone ?? "").trim(),
        relationship: String(row.relationship ?? "").trim(),
        address: row.address != null ? String(row.address).trim() : undefined,
      }))
      .filter((row) => row.full_name && row.phone && row.relationship)
  : [];

 const collateral = Array.isArray(input.collateral)
  ? (input.collateral as Array<Record<string, unknown>>)
      .map((row) => {
        const collateral_type = String(row.collateral_type ?? row.type ?? "").trim();
        const estimated_value = Number(row.estimated_value ?? row.value ?? 0);
        const description = String(row.description ?? "").trim();
        if (!collateral_type || !Number.isFinite(estimated_value) || estimated_value <= 0) {
          return null;
        }
        const id = row.id != null ? String(row.id).trim() : "";
        return {
          ...(id ? { id } : {}),
          collateral_type,
          estimated_value,
          description,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
  : [];

 const payload: Record<string, unknown> = {
 customer_type,
 first_name,
 middle_name,
 last_name,
 date_of_birth,
 gender,
 national_id: String(input.national_id ?? "").trim(),
 phone_number,
 physical_address: String(input.physical_address ?? "").trim(),
 region: String(input.region ?? "").trim() || "Dar es Salaam",
 district: String(input.district ?? "").trim() || "Kinondoni",
 ward: String(input.ward ?? "").trim() || "Unknown",
 employment_type,
 monthly_income,
 business_name: businessName || null,
 business_type: input.business_type ? String(input.business_type).trim() : null,
 business_address: input.business_address ? String(input.business_address).trim() : null,
 business_registration_number: input.business_registration_no
 ? String(input.business_registration_no).trim()
 : null,
 years_in_business:
 input.years_in_business != null && input.years_in_business !== ""
 ? Math.max(0, Math.round(Number(input.years_in_business)))
 : null,
 home_latitude: input.home_latitude ?? null,
 home_longitude: input.home_longitude ?? null,
 business_latitude: input.business_latitude ?? null,
 business_longitude: input.business_longitude ?? null,
 next_of_kin_name: nokName || "Not specified",
 next_of_kin_relationship: nokRel || "spouse",
 next_of_kin_phone: nokPhone || phone_number,
 next_of_kin_address: nokAddr || String(input.district ?? "").trim() || "Not specified",
 risk_grade,
 credit_score,
 is_blacklisted,
 branch_id: String(input.branch_id ?? "").trim(),
 metadata: {
 monthly_income,
 street: input.street ?? null,
 payment_reference: input.payment_reference ?? null,
 loan_officer_id: input.loan_officer_id ?? null,
 created_by: input.created_by ?? null,
 notes: input.notes ?? null,
 registration_fee_paid: input.registration_fee_paid ?? null,
 registration_fee_amount: input.registration_fee_amount ?? null,
 registration_fee_paid_at: input.registration_fee_paid_at ?? null,
 id_type: input.id_type ?? null,
 occupation: input.occupation ?? null,
 employer_name: input.employer_name ?? null,
 employer_address: input.employer_address ?? null,
 employer_phone: input.employer_phone ?? null,
 employment_start_date: input.employment_start_date ?? null,
 cheque_number: input.cheque_number ?? null,
 status: input.status ?? null,
 blacklist_reason: input.blacklist_reason ? String(input.blacklist_reason).trim() : null,
 business_address: input.business_address ? String(input.business_address).trim() : null,
 home_latitude: input.home_latitude ?? null,
 home_longitude: input.home_longitude ?? null,
 business_latitude: input.business_latitude ?? null,
 business_longitude: input.business_longitude ?? null,
 ...(guarantors.length > 0 ? { guarantors } : {}),
 ...(references.length > 0 ? { references } : {}),
 ...(collateral.length > 0 ? { collateral } : {}),
 },
 };

 if (collateral.length > 0) payload.collateral = collateral;

 if (email) payload.email = email;
 if (alternate_phone) payload.alternate_phone = alternate_phone;

 return payload;
}
