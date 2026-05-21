export type ParseMapLinkSuccess = {
  ok: true;
  latitude: number;
  longitude: number;
};

export type ParseMapLinkFailure = {
  ok: false;
  code: "empty" | "invalid_url" | "short_link" | "unsupported" | "no_coordinates";
  message: string;
};

export type ParseMapLinkResult = ParseMapLinkSuccess | ParseMapLinkFailure;

function isValidCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

function tryPair(lat: number, lng: number): ParseMapLinkSuccess | null {
  if (!isValidCoordinate(lat, lng)) return null;
  return { ok: true, latitude: lat, longitude: lng };
}

/** Parses "lat,lng" or "lat lng" from a fragment or query value. */
function parseCoordinatePair(value: string): ParseMapLinkSuccess | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return tryPair(parseFloat(match[1]), parseFloat(match[2]));
}

const SHORT_LINK_HOSTS = ["goo.gl", "maps.app.goo.gl", "apple.co", "map.app"];

function isShortLink(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return SHORT_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

function extractFromGoogleStyleUrl(raw: string): ParseMapLinkSuccess | null {
  const d3d4 = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (d3d4) {
    const hit = tryPair(parseFloat(d3d4[1]), parseFloat(d3d4[2]));
    if (hit) return hit;
  }

  const at = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const hit = tryPair(parseFloat(at[1]), parseFloat(at[2]));
    if (hit) return hit;
  }

  const searchPath = raw.match(/\/search\/(-?\d+(?:\.\d+)?)[,+](-?\d+(?:\.\d+)?)/i);
  if (searchPath) {
    const hit = tryPair(parseFloat(searchPath[1]), parseFloat(searchPath[2]));
    if (hit) return hit;
  }

  return null;
}

function extractFromOpenStreetMap(url: URL): ParseMapLinkSuccess | null {
  const hash = url.hash.match(/#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (hash) {
    const hit = tryPair(parseFloat(hash[1]), parseFloat(hash[2]));
    if (hit) return hit;
  }

  const mlat = url.searchParams.get("mlat");
  const mlon = url.searchParams.get("mlon");
  if (mlat && mlon) {
    const hit = tryPair(parseFloat(mlat), parseFloat(mlon));
    if (hit) return hit;
  }

  return null;
}

function extractFromQueryParams(url: URL): ParseMapLinkSuccess | null {
  const keys = ["ll", "q", "center", "destination", "sll", "daddr", "saddr", "pt"];
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const hit = parseCoordinatePair(decodeURIComponent(value));
    if (hit) return hit;
  }
  return null;
}

function extractFromBing(url: URL, raw: string): ParseMapLinkSuccess | null {
  const cp = url.searchParams.get("cp");
  if (cp) {
    const parts = cp.split(/[~|]/);
    if (parts.length >= 2) {
      const hit = tryPair(parseFloat(parts[0]), parseFloat(parts[1]));
      if (hit) return hit;
    }
  }

  const rtp = raw.match(/rtp=pos\.(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)/i);
  if (rtp) {
    const hit = tryPair(parseFloat(rtp[1]), parseFloat(rtp[2]));
    if (hit) return hit;
  }

  return null;
}

/**
 * Extracts latitude and longitude from common map provider links or plain coordinate text.
 */
export function parseMapLink(input: string): ParseMapLinkResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "empty",
      message: "Paste a map link or coordinates (latitude, longitude).",
    };
  }

  const plain = parseCoordinatePair(trimmed);
  if (plain) return plain;

  const geo = trimmed.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (geo) {
    const hit = tryPair(parseFloat(geo[1]), parseFloat(geo[2]));
    if (hit) return hit;
  }

  let url: URL;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    url = new URL(normalized);
  } catch {
    return {
      ok: false,
      code: "invalid_url",
      message: "That does not look like a valid link. Use a full map URL or coordinates like -6.7924, 39.2083.",
    };
  }

  if (isShortLink(url.hostname)) {
    return {
      ok: false,
      code: "short_link",
      message:
        "Short links cannot be read here. Open the link in your browser, copy the full address from the bar, paste it here, or select the location on the map.",
    };
  }

  const host = url.hostname.toLowerCase();
  const raw = url.toString();

  const isGoogle =
    host.includes("google.com") || host.includes("google.co.") || host.includes("maps.google");
  const isApple = host.includes("maps.apple.com") || host.includes("apple.com/maps");
  const isOsm = host.includes("openstreetmap.org");
  const isBing = host.includes("bing.com") && raw.includes("map");

  if (isGoogle) {
    const fromGoogle = extractFromGoogleStyleUrl(raw) ?? extractFromQueryParams(url);
    if (fromGoogle) return fromGoogle;
  }

  if (isApple) {
    const fromApple = extractFromQueryParams(url) ?? extractFromGoogleStyleUrl(raw);
    if (fromApple) return fromApple;
  }

  if (isOsm) {
    const fromOsm = extractFromOpenStreetMap(url) ?? extractFromQueryParams(url);
    if (fromOsm) return fromOsm;
  }

  if (isBing) {
    const fromBing = extractFromBing(url, raw) ?? extractFromQueryParams(url);
    if (fromBing) return fromBing;
  }

  const generic =
    extractFromGoogleStyleUrl(raw) ??
    extractFromQueryParams(url) ??
    extractFromOpenStreetMap(url) ??
    extractFromBing(url, raw);

  if (generic) return generic;

  const knownProvider = isGoogle || isApple || isOsm || isBing;
  return {
    ok: false,
    code: knownProvider ? "no_coordinates" : "unsupported",
    message: knownProvider
      ? "We could not find coordinates in this link. Please drop a pin on the map to set the location manually."
      : "This map provider is not supported. Paste a Google Maps, Apple Maps, or OpenStreetMap link, or pick the location on the map.",
  };
}
