import type { LeadView } from "@/lib/lead-adapters";

/** Query keys on `/customers/new` when converting a lead. */
export const LEAD_PREFILL_PARAM = "from_lead";

export function newCustomerPathForRole(role?: string): string {
  if (role === "branch_manager") return "/manager/customers/new";
  if (role === "loan_officer") return "/officer/customers/new";
  return "/customers/new";
}

/** Use edit-form values when converting the lead currently being edited. */
export function leadViewFromEditForm(
  base: LeadView,
  edit: {
    fullName: string;
    phoneNumber: string;
    alternatePhone: string;
    locationName: string;
    region: string;
    district: string;
    ward: string;
    notes: string;
  }
): LeadView {
  return {
    ...base,
    fullName: edit.fullName,
    phoneNumber: edit.phoneNumber,
    alternatePhone: edit.alternatePhone.trim() || undefined,
    locationName: edit.locationName,
    region: edit.region.trim() || undefined,
    district: edit.district.trim() || undefined,
    ward: edit.ward.trim() || undefined,
    notes: edit.notes,
  };
}

/** Build new-customer URL with lead fields as query params (survives navigation + Strict Mode). */
export function buildNewCustomerUrlFromLead(lead: LeadView, role?: string): string {
  const path = newCustomerPathForRole(role);
  const params = new URLSearchParams();
  params.set(LEAD_PREFILL_PARAM, lead.id);

  const set = (key: string, value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) params.set(key, trimmed);
  };

  set("full_name", lead.fullName);
  set("phone", lead.phoneNumber);
  set("alt_phone", lead.alternatePhone);
  set("region", lead.region);
  set("district", lead.district);
  set("ward", lead.ward);
  set("street", lead.locationName);
  set("notes", lead.notes);
  set("branch_id", lead.branchId);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export type LeadCustomerPrefillFields = {
  full_name: string;
  phone: string;
  alt_phone: string;
  region: string;
  district: string;
  ward: string;
  street: string;
  notes: string;
  branch_id: string;
};

export function parseLeadPrefillFromSearchParams(
  searchParams: URLSearchParams
): { leadId: string | null; fields: Partial<LeadCustomerPrefillFields> } {
  const leadId = searchParams.get(LEAD_PREFILL_PARAM)?.trim() || null;
  if (!leadId) return { leadId: null, fields: {} };

  const get = (key: keyof LeadCustomerPrefillFields) =>
    searchParams.get(key)?.trim() ?? "";

  return {
    leadId,
    fields: {
      full_name: get("full_name"),
      phone: get("phone"),
      alt_phone: get("alt_phone"),
      region: get("region"),
      district: get("district"),
      ward: get("ward"),
      street: get("street"),
      notes: get("notes"),
      branch_id: get("branch_id"),
    },
  };
}
