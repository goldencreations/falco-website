import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
} from "@/lib/group-meeting-location";

export type CustomerGeoPin = {
  latitude: number;
  longitude: number;
};

export type CustomerAddressFields = {
  physical_address?: string | null;
  business_address?: string | null;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
};

function parseCoordinate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Parse `metadata` whether the API returns an object or a JSON string. */
export function parseCustomerMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.metadata;
  if (raw && typeof raw === "object" && raw !== null) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  return {};
}

function readPin(
  row: Record<string, unknown>,
  md: Record<string, unknown>,
  latKey: string,
  lngKey: string
): CustomerGeoPin | null {
  const latitude = parseCoordinate(row[latKey] ?? md[latKey]);
  const longitude = parseCoordinate(row[lngKey] ?? md[lngKey]);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** Read home/business pins from API row or metadata (with generic lat/lng fallback for leads). */
export function readCustomerLocationPins(row: Record<string, unknown>): {
  home: CustomerGeoPin | null;
  business: CustomerGeoPin | null;
} {
  const md = parseCustomerMetadata(row);

  const home = readPin(row, md, "home_latitude", "home_longitude");
  const business = readPin(row, md, "business_latitude", "business_longitude");

  if (!home) {
    const generic = readPin(row, md, "latitude", "longitude");
    return { home: generic, business };
  }

  return { home, business };
}

export function customerHomeAddressQuery(customer: CustomerAddressFields): string {
  return [customer.physical_address, customer.ward, customer.district, customer.region, "Tanzania"]
    .map((part) => (part != null ? String(part).trim() : ""))
    .filter(Boolean)
    .join(", ");
}

export function customerBusinessAddressQuery(customer: CustomerAddressFields): string {
  const business = customer.business_address?.trim();
  if (business) {
    return [business, customer.ward, customer.district, customer.region, "Tanzania"]
      .map((part) => (part != null ? String(part).trim() : ""))
      .filter(Boolean)
      .join(", ");
  }
  return customerHomeAddressQuery(customer);
}

function encodeMapsQuery(query: string): string {
  return encodeURIComponent(query.trim());
}

export function customerLocationEmbedUrl(
  pin: CustomerGeoPin | null,
  addressQuery: string
): string | null {
  if (pin) return googleMapsEmbedUrl(pin);
  const address = addressQuery.trim();
  if (!address) return null;
  return `https://maps.google.com/maps?q=${encodeMapsQuery(address)}&z=14&output=embed`;
}

export function customerLocationSearchUrl(
  pin: CustomerGeoPin | null,
  addressQuery: string
): string | null {
  if (pin) return googleMapsSearchUrl(pin);
  const address = addressQuery.trim();
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeMapsQuery(address)}`;
}

export function customerLocationDirectionsUrl(
  pin: CustomerGeoPin | null,
  addressQuery: string
): string | null {
  if (pin) return googleMapsDirectionsUrl(pin);
  const address = addressQuery.trim();
  if (!address) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeMapsQuery(address)}`;
}

export function customerHasMapPin(customer: {
  home_latitude?: number | null;
  home_longitude?: number | null;
  business_latitude?: number | null;
  business_longitude?: number | null;
}): boolean {
  return Boolean(
    (customer.home_latitude != null && customer.home_longitude != null) ||
      (customer.business_latitude != null && customer.business_longitude != null)
  );
}

export function customerHasLocationData(
  customer: CustomerAddressFields & {
    home_latitude?: number | null;
    home_longitude?: number | null;
    business_latitude?: number | null;
    business_longitude?: number | null;
  }
): boolean {
  return (
    customerHasMapPin(customer) ||
    Boolean(customerHomeAddressQuery(customer).trim()) ||
    Boolean(customer.business_address?.trim()) ||
    Boolean(customer.business_name?.trim())
  );
}

export { googleMapsDirectionsUrl, googleMapsEmbedUrl, googleMapsSearchUrl };
