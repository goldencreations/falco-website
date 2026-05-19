export type NominatimAddressDetails = {
 road?: string;
 pedestrian?: string;
 footway?: string;
 suburb?: string;
 neighbourhood?: string;
 city_district?: string;
 district?: string;
 city?: string;
 town?: string;
 village?: string;
 county?: string;
 state?: string;
 municipality?: string;
};

export type ParsedNominatimPlace = {
 /** Street or nearest named place */
 locationName: string;
 region: string;
 district: string;
 ward: string;
 displayName: string;
};

export function parseNominatimAddress(
 address?: NominatimAddressDetails,
 displayName?: string
): ParsedNominatimPlace {
 const road =
 address?.road?.trim() ||
 address?.pedestrian?.trim() ||
 address?.footway?.trim() ||
 "";
 const ward = (address?.suburb ?? address?.neighbourhood ?? "").trim();
 const district = (address?.city_district ?? address?.county ?? address?.district ?? "").trim();
 const region = (
 address?.state ??
 address?.city ??
 address?.town ??
 address?.municipality ??
 address?.village ??
 ""
 ).trim();

 const locationName =
 road || displayName?.split(",")[0]?.trim() || ward || district || "";

 return {
 locationName,
 region,
 district,
 ward,
 displayName: displayName?.trim() ?? "",
 };
}

/** Reverse geocode coordinates to Tanzania-friendly address parts (OpenStreetMap Nominatim). */
export async function reverseGeocodeNominatim(
 latitude: number,
 longitude: number
): Promise<ParsedNominatimPlace> {
 const params = new URLSearchParams({
 lat: String(latitude),
 lon: String(longitude),
 format: "jsonv2",
 addressdetails: "1",
 zoom: "18",
 });
 const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
 if (!response.ok) {
 throw new Error("Reverse geocode failed");
 }
 const data = (await response.json()) as {
 display_name?: string;
 address?: NominatimAddressDetails;
 };
 return parseNominatimAddress(data.address, data.display_name);
}
