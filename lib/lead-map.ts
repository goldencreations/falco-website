import type { LeadView } from "@/lib/lead-adapters";

export type LeadMapCoords = { latitude: string; longitude: string };

function isValidCoord(lat: number, lng: number): boolean {
 return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Parse stored latitude/longitude strings (API may return numbers). */
export function parseLeadCoordinates(lead: Pick<LeadView, "latitude" | "longitude">): LeadMapCoords | null {
 const latRaw = lead.latitude?.trim();
 const lngRaw = lead.longitude?.trim();
 if (!latRaw || !lngRaw) return null;
 const lat = Number(latRaw);
 const lng = Number(lngRaw);
 if (!isValidCoord(lat, lng)) return null;
 return { latitude: String(lat), longitude: String(lng) };
}

/** Text query for maps when GPS coordinates are unavailable. */
export function leadMapAddressQuery(lead: Pick<LeadView, "locationName" | "region" | "district" | "ward">): string {
 const parts = [lead.locationName, lead.ward, lead.district, lead.region, "Tanzania"].filter(
 (part) => part && String(part).trim()
 );
 return parts.join(", ");
}

export function leadHasMapTarget(lead: Pick<LeadView, "latitude" | "longitude" | "locationName">): boolean {
 return Boolean(parseLeadCoordinates(lead) || lead.locationName?.trim());
}

function encodeMapsQuery(query: string): string {
 return encodeURIComponent(query.trim());
}

type LeadMapTarget = Pick<LeadView, "latitude" | "longitude" | "locationName" | "region" | "district" | "ward">;

export function leadMapEmbedUrl(lead: LeadMapTarget): string | null {
 const coords = parseLeadCoordinates(lead);
 if (coords) {
 return `https://maps.google.com/maps?q=${coords.latitude},${coords.longitude}&z=15&output=embed`;
 }
 const address = leadMapAddressQuery(lead);
 if (!address) return null;
 return `https://maps.google.com/maps?q=${encodeMapsQuery(address)}&z=14&output=embed`;
}

export function leadMapViewUrl(lead: LeadMapTarget): string | null {
 const coords = parseLeadCoordinates(lead);
 if (coords) {
 return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
 }
 const address = leadMapAddressQuery(lead);
 if (!address) return null;
 return `https://www.google.com/maps/search/?api=1&query=${encodeMapsQuery(address)}`;
}

export function leadMapDirectionsUrl(lead: LeadMapTarget): string | null {
 const coords = parseLeadCoordinates(lead);
 if (coords) {
 return `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;
 }
 const address = leadMapAddressQuery(lead);
 if (!address) return null;
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeMapsQuery(address)}`;
}
