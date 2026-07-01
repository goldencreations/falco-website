import type { FalcoApiErrorDetail } from "@/lib/falco-api";

export type FormFieldErrors = Record<string, string>;

const API_FIELD_ALIASES: Record<string, string> = {
  name: "full_name",
  full_name: "full_name",
  phone: "phone",
    alt_phone: "alt_phone",
    email: "email",
  physical_address: "physical_address",
  national_id: "national_id",
  id_type: "id_type",
  payment_reference: "payment_reference",
  branch_id: "branch_id",
  loan_officer_id: "loan_officer_id",
    status: "status",
    years_in_business: "years_in_business",
    risk_score: "risk_score",
};

export function summarizeFieldErrors(errors: FormFieldErrors): string {
  const entries = Object.entries(errors);
  if (entries.length === 0) return "";
  if (entries.length === 1) return entries[0][1];
  return `Please fix ${entries.length} fields highlighted below.`;
}

export function formFieldLabel(key: string): string {
  if (key === "_form") return "Form";
  const staticLabels: Record<string, string> = {
    full_name: "Full name",
    phone: "Primary phone",
    alt_phone: "Alternative phone",
    email: "Email",
    physical_address: "Physical address",
    national_id: "National ID",
    payment_reference: "Payment reference",
    branch_id: "Branch",
    loan_officer_id: "Loan officer",
    years_in_business: "Years in business",
    risk_score: "Risk score",
    "attachments.passport_photo": "Passport photo",
    "attachments.home_location_photos": "Home location photos",
    "attachments.business_location_photos": "Business location photos",
    "attachments.supporting_documents": "Supporting documents",
  };
  if (staticLabels[key]) return staticLabels[key];

  const guarantorMatch = /^guarantors\.(\d+)\.(\w+)$/.exec(key);
  if (guarantorMatch) {
    const index = Number(guarantorMatch[1]) + 1;
    const field = formatSubFieldLabel(guarantorMatch[2]);
    return `Guarantor ${index} — ${field}`;
  }

  const collateralMatch = /^collateral\.(\d+)\.(\w+)$/.exec(key);
  if (collateralMatch) {
    const index = Number(collateralMatch[1]) + 1;
    const field = formatSubFieldLabel(collateralMatch[2]);
    return `Collateral ${index} — ${field}`;
  }

  const referenceMatch = /^references\.(\d+)\.(\w+)$/.exec(key);
  if (referenceMatch) {
    const index = Number(referenceMatch[1]) + 1;
    const field = formatSubFieldLabel(referenceMatch[2]);
    return `Reference ${index} — ${field}`;
  }

  return key.replace(/_/g, " ");
}

function formatSubFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: "Full name",
    phone: "Phone",
    relationship: "Relationship",
    otherRelationship: "Relationship",
    nationalId: "National ID",
    address: "Address",
    collateralType: "Collateral type",
    collateralEstimatedValue: "Collateral value",
    collateralDescription: "Collateral description",
    estimatedValue: "Estimated value",
    description: "Description",
    images: "Collateral image",
    idFront: "ID front",
    idBack: "ID back",
    photo: "Photo",
    photoWithCustomer: "Photo with customer",
    wardLetter: "Ward letter",
    attachments: "Attachments",
  };
  return labels[field] ?? field.replace(/_/g, " ");
}

export function apiDetailsToFieldErrors(details: FalcoApiErrorDetail[] | undefined): FormFieldErrors {
  const errors: FormFieldErrors = {};
  if (!details?.length) return errors;

  for (const detail of details) {
    const message = detail.message?.trim();
    if (!message) continue;
    const rawField = detail.field?.trim();
    const key = rawField ? (API_FIELD_ALIASES[rawField] ?? rawField) : "_form";
    errors[key] = message;
  }
  return errors;
}

export function scrollToFormField(fieldKey: string) {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    let el: Element | null = document.querySelector(
      `[data-form-field="${CSS.escape(fieldKey)}"]`
    );
    if (!el) {
      const parts = fieldKey.split(".");
      while (parts.length > 1 && !el) {
        parts.pop();
        el = document.querySelector(`[data-form-field="${CSS.escape(parts.join("."))}"]`);
      }
    }
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el?.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select, [role=combobox], button[role=combobox]"
    );
    focusable?.focus({ preventScroll: true });
  });
}

export function clearFieldErrorsByPrefix(
  errors: FormFieldErrors,
  prefix: string
): FormFieldErrors {
  const next = { ...errors };
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) delete next[key];
  }
  return next;
}
