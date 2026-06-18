import type { NominatimAddressDetails } from "@/lib/nominatim";

export type PlaceSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddressDetails;
};

export async function searchPlacesInTanzania(
  query: string,
  options?: { limit?: number; context?: string }
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const searchQuery = options?.context ? `${q}, ${options.context}` : q;
  const params = new URLSearchParams({
    q: searchQuery,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "tz",
    limit: String(options?.limit ?? 5),
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!response.ok) return [];
  const data = (await response.json()) as PlaceSuggestion[];
  return Array.isArray(data) ? data : [];
}
