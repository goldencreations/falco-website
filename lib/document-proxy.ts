/**
 * Convert an authenticated backend document URL to a same-origin proxy URL.
 * The proxy route (/api/document-proxy) reads the session cookie server-side
 * and adds the required `Authorization: Bearer` header before forwarding the
 * request to the backend, so plain <img src> and <a href> tags work normally.
 *
 * Non-backend URLs (e.g. blob:, data:, or other origins) are returned as-is.
 */
export function toProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "falcobackend.habitek.co.tz") {
      return `/api/document-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // relative URLs or malformed — return as-is
  }
  return url;
}
