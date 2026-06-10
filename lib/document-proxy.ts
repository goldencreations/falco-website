import { DEFAULT_FALCO_API_BASE_URL } from "@/lib/falco-api";

const BACKEND_HOSTS = new Set(["falcobackend.habitek.co.tz"]);

function backendBaseUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_FALCO_API_URL?.trim() ||
        process.env.FALCO_API_BASE_URL?.trim()
      : undefined;
  return (fromEnv || DEFAULT_FALCO_API_BASE_URL).replace(/\/+$/, "");
}

function isBackendHost(hostname: string): boolean {
  return BACKEND_HOSTS.has(hostname);
}

/**
 * Convert an authenticated backend document URL to a same-origin proxy URL.
 * The proxy route (/api/document-proxy) reads the session cookie server-side
 * and adds the required `Authorization: Bearer` header before forwarding the
 * request to the backend, so plain <img src> and <a href> tags work normally.
 *
 * Non-backend URLs (e.g. blob:, data:, signed CDN URLs) are returned as-is.
 */
export function toProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/api/document-proxy")) return trimmed;

  if (trimmed.startsWith("/")) {
    const absolute = `${backendBaseUrl()}${trimmed}`;
    return `/api/document-proxy?url=${encodeURIComponent(absolute)}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (isBackendHost(parsed.hostname)) {
      return `/api/document-proxy?url=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
