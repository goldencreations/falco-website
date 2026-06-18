import { digitsOnly } from "@/lib/tz-form-inputs";
import type { LeadView } from "@/lib/lead-adapters";
import { parseLeadCoordinates } from "@/lib/lead-map";
import type { Customer } from "@/lib/types";

/** Normalize TZ phones for matching (255…, 0…, or 9-digit local). */
export function normalizePhoneForMatch(phone: string | undefined | null): string {
  let d = digitsOnly(phone ?? "");
  if (d.startsWith("255")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(-9);
}

export function leadMatchesCustomer(lead: LeadView, customer: Customer): boolean {
  if (lead.customerId && lead.customerId === customer.id) return true;

  const customerPhones = new Set(
    [customer.phone_primary, customer.phone_secondary]
      .map(normalizePhoneForMatch)
      .filter((p) => p.length >= 9)
  );
  if (!customerPhones.size) return false;

  const leadPhones = [lead.phoneNumber, lead.alternatePhone]
    .map(normalizePhoneForMatch)
    .filter((p) => p.length >= 9);

  return leadPhones.some((p) => customerPhones.has(p));
}

export function filterLeadsForCustomer(leads: LeadView[], customer: Customer): LeadView[] {
  return leads.filter((lead) => leadMatchesCustomer(lead, customer));
}

export type ApplicationLocationSource = {
  id: string;
  kind: "lead" | "customer_home" | "customer_business";
  label: string;
  subtitle: string;
  latitude: string;
  longitude: string;
};

function coordsFromCustomerPin(
  lat: number | null | undefined,
  lng: number | null | undefined
): { latitude: string; longitude: string } | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat.toFixed(6), longitude: lng.toFixed(6) };
}

export function buildApplicationLocationSources(
  customer: Customer,
  leads: LeadView[]
): ApplicationLocationSource[] {
  const sources: ApplicationLocationSource[] = [];
  const matchedLeads = filterLeadsForCustomer(leads, customer);

  for (const lead of matchedLeads) {
    const coords = parseLeadCoordinates(lead);
    if (!coords) continue;
    const typeLabel =
      lead.locationType === "work"
        ? "Work"
        : lead.locationType === "sponsor"
          ? "Sponsor"
          : "Home";
    sources.push({
      id: `lead-${lead.id}`,
      kind: "lead",
      label: `Lead — ${typeLabel}`,
      subtitle: lead.locationName || lead.fullName,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  }

  const home = coordsFromCustomerPin(customer.home_latitude, customer.home_longitude);
  if (home) {
    sources.push({
      id: "customer-home",
      kind: "customer_home",
      label: "Customer profile — Home",
      subtitle: [customer.physical_address, customer.ward, customer.district, customer.region]
        .filter(Boolean)
        .join(", "),
      latitude: home.latitude,
      longitude: home.longitude,
    });
  }

  const business = coordsFromCustomerPin(customer.business_latitude, customer.business_longitude);
  if (business) {
    sources.push({
      id: "customer-business",
      kind: "customer_business",
      label: "Customer profile — Business",
      subtitle:
        customer.business_address ||
        [customer.physical_address, customer.ward, customer.district, customer.region]
          .filter(Boolean)
          .join(", "),
      latitude: business.latitude,
      longitude: business.longitude,
    });
  }

  return sources;
}

export function defaultApplicationLocationSource(
  sources: ApplicationLocationSource[]
): ApplicationLocationSource | null {
  const leadHome = sources.find((s) => s.kind === "lead" && s.label.includes("Home"));
  if (leadHome) return leadHome;
  const anyLead = sources.find((s) => s.kind === "lead");
  if (anyLead) return anyLead;
  return sources[0] ?? null;
}
