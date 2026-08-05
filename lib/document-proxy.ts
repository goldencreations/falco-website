import {
  getAllowedDocumentProxyHostnames,
  getFalcoApiBaseUrl,
  getFalcoApiHostname,
} from "@/lib/falco-api";

/** Paths the Falco API serves for customer/application media. */
const BACKEND_MEDIA_PATH =
  /^\/(storage|documents|media|uploads|files)(\/|$)/i;

function isBackendMediaPath(pathname: string): boolean {
  return BACKEND_MEDIA_PATH.test(pathname);
}

/**
 * Force absolute media URLs onto `FALCO_API_BASE_URL`.
 * Backend responses often still embed a previous host (e.g. habitek); keep path/query, swap origin.
 */
export function rewriteToConfiguredBackendUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("/")) {
    return `${getFalcoApiBaseUrl()}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const configuredHost = getFalcoApiHostname();
    const allowed = getAllowedDocumentProxyHostnames();
    const shouldRewrite =
      parsed.hostname !== configuredHost &&
      (allowed.includes(parsed.hostname) || isBackendMediaPath(parsed.pathname));

    if (shouldRewrite) {
      const base = getFalcoApiBaseUrl();
      return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function isProxiedBackendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowed = getAllowedDocumentProxyHostnames();
    if (allowed.includes(parsed.hostname)) return true;
    if (parsed.hostname === getFalcoApiHostname()) return true;
    return isBackendMediaPath(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Convert an authenticated backend document URL to a same-origin proxy URL.
 * Rewrites legacy backend hosts to `FALCO_API_BASE_URL` first.
 * Non-backend URLs (e.g. blob:, data:, signed CDN URLs) are returned as-is.
 */
export function toProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/api/document-proxy")) return trimmed;

  const rewritten = rewriteToConfiguredBackendUrl(trimmed);

  if (rewritten.startsWith("/")) {
    const absolute = `${getFalcoApiBaseUrl()}${rewritten}`;
    return `/api/document-proxy?url=${encodeURIComponent(absolute)}`;
  }

  try {
    if (isProxiedBackendUrl(rewritten)) {
      return `/api/document-proxy?url=${encodeURIComponent(rewritten)}`;
    }
  } catch {
    return rewritten;
  }

  return rewritten;
}
