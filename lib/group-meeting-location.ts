/**
 * Meeting location coordinates for vikundi groups.
 * Falco `LoanGroup` exposes `meeting_location` text; coordinates are stored in
 * `notes` via `[MEETING_GEO:lat,lng]` until the API adds dedicated fields.
 */

const MEETING_GEO_RE = /\[MEETING_GEO:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/i;

export type MeetingGeo = {
  latitude: number;
  longitude: number;
};

export function parseMeetingGeoFromNotes(notes?: string | null): MeetingGeo | null {
  if (!notes?.trim()) return null;
  const match = notes.match(MEETING_GEO_RE);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function stripMeetingGeoFromNotes(notes?: string | null): string {
  if (!notes?.trim()) return "";
  return notes.replace(MEETING_GEO_RE, "").trim();
}

export function encodeMeetingGeoInNotes(
  notes: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): string {
  const cleaned = stripMeetingGeoFromNotes(notes);
  if (latitude == null || longitude == null) return cleaned;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return cleaned;
  const tag = `[MEETING_GEO:${latitude.toFixed(6)},${longitude.toFixed(6)}]`;
  return cleaned ? `${cleaned}\n${tag}` : tag;
}

export function googleMapsSearchUrl(geo: MeetingGeo): string {
  return `https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}`;
}

export function googleMapsDirectionsUrl(geo: MeetingGeo): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${geo.latitude},${geo.longitude}`;
}

export function googleMapsEmbedUrl(geo: MeetingGeo): string {
  return `https://maps.google.com/maps?q=${geo.latitude},${geo.longitude}&z=15&output=embed`;
}
