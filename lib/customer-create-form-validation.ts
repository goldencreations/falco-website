import type { CustomerAttachmentFormState } from "@/lib/customer-attachments";
import { validateCustomerAttachments } from "@/lib/customer-attachments";
import {
  validateCustomerCollateral,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";
import {
  validateCustomerGuarantors,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";
import {
  validateCustomerReferences,
  type CustomerReferenceFormRow,
} from "@/lib/customer-references";
import { normalizeCustomerIdType } from "@/lib/customer-id-types";
import type { FormFieldErrors } from "@/lib/customer-form-errors";
import { digitsOnly, TZ_NIDA_MAX_DIGITS, TZ_PHONE_MAX_DIGITS } from "@/lib/tz-form-inputs";

export type CustomerCreateFormValidationInput = {
  form: {
    full_name: string;
    phone: string;
    alt_phone: string;
    email: string;
    physical_address: string;
    national_id: string;
    id_type: string;
    years_in_business: string;
    risk_score: string;
    branch_id: string;
    loan_officer_id: string;
  };
  sessionLoaded: boolean;
  user: { branch_id?: string | null } | null | undefined;
  isOfficerView: boolean;
  lockedBranchId: string;
  guarantors: CustomerGuarantorFormRow[];
  collateral: CustomerCollateralFormRow[];
  references: CustomerReferenceFormRow[];
  attachments: CustomerAttachmentFormState;
};

export function validateCustomerCreateForm(
  input: CustomerCreateFormValidationInput
): FormFieldErrors {
  const errors: FormFieldErrors = {};

  if (!input.sessionLoaded || !input.user) {
    errors._form = "Session is still loading. Please wait a moment and try again.";
    return errors;
  }
  if (input.isOfficerView && !input.user.branch_id?.trim()) {
    errors._form = "Your account is not linked to a branch. Contact an administrator.";
    return errors;
  }

  const phoneDigits = digitsOnly(input.form.phone);
  const altPhoneDigits = digitsOnly(input.form.alt_phone);
  const nationalIdDigits = digitsOnly(input.form.national_id);
  const email = input.form.email.trim();
  const yearsInBusiness = input.form.years_in_business.trim();
  const riskScore = input.form.risk_score.trim();

  if (!input.form.full_name.trim()) errors.full_name = "Enter the customer's full name.";
  if (!input.form.phone.trim()) {
    errors.phone = "Enter the customer's primary phone number.";
  } else if (phoneDigits.length !== TZ_PHONE_MAX_DIGITS) {
    errors.phone = "Enter a 10 digit phone number, for example 0712345678.";
  }
  if (input.form.alt_phone.trim() && altPhoneDigits.length !== TZ_PHONE_MAX_DIGITS) {
    errors.alt_phone = "Enter a 10 digit phone number, or leave this field empty.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address, or leave this field empty.";
  }
  if (!input.form.physical_address.trim()) errors.physical_address = "Enter where the customer lives.";
  if (!input.form.national_id.trim()) {
    errors.national_id = "Enter the customer's ID number.";
  } else if (normalizeCustomerIdType(input.form.id_type) === "NIDA" && nationalIdDigits.length !== TZ_NIDA_MAX_DIGITS) {
    errors.national_id = "Enter a complete 20 digit NIDA number.";
  }
  if (yearsInBusiness && Number(yearsInBusiness) < 0) {
    errors.years_in_business = "Years in business cannot be less than zero.";
  }
  if (riskScore && (Number(riskScore) < 0 || !Number.isFinite(Number(riskScore)))) {
    errors.risk_score = "Risk score must be zero or more.";
  }
  if (!input.form.branch_id && !input.lockedBranchId) errors.branch_id = "Please select a branch.";
  if (!input.isOfficerView && !input.form.loan_officer_id) {
    errors.loan_officer_id = "Please assign a loan officer.";
  }

  const nestedChecks = [
    validateCustomerAttachments(input.attachments),
    validateCustomerGuarantors(input.guarantors),
    validateCustomerCollateral(input.collateral),
    validateCustomerReferences(input.references),
  ];

  for (const check of nestedChecks) {
    if (!check.ok) errors[check.field] = check.error;
  }

  return errors;
}
