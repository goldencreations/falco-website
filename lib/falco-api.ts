/** When `FALCO_API_BASE_URL` is unset, requests go here (see `backend-documentation/auth-controller.md`, `.env.example`). */
export const FALCO_API_BASE_URL_ENV = "FALCO_API_BASE_URL";

export const FALCO_API_CONFIG_MESSAGE =
  "FALCO_API_BASE_URL is not set. Copy .env.example to .env.local and set the backend URL.";

let falcoApiBaseUrlWarned = false;

export type FalcoApiErrorDetail = { field?: string; message?: string };

export class FalcoApiError extends Error {
 readonly status: number;
 readonly code?: string;
 readonly details?: FalcoApiErrorDetail[];

 constructor(
 message: string,
 options: { status: number; code?: string; details?: FalcoApiErrorDetail[] }
 ) {
 super(message);
 this.name = "FalcoApiError";
 this.status = options.status;
 this.code = options.code;
 this.details = options.details;
 }
}

/** Backend API origin from `FALCO_API_BASE_URL` (.env / host env). No trailing slash. */
export function getFalcoApiBaseUrl(): string {
 const base = process.env.FALCO_API_BASE_URL?.trim();
 if (!base) {
  throw new FalcoApiError(FALCO_API_CONFIG_MESSAGE, { status: 500, code: "CONFIG_ERROR" });
 }
 return base.replace(/\/+$/, "");
}

/** Hostname of the configured backend (for document-proxy allowlists). */
export function getFalcoApiHostname(): string {
 return new URL(getFalcoApiBaseUrl()).hostname;
}

/**
 * Hostnames allowed through `/api/document-proxy`.
 * Includes `FALCO_API_BASE_URL` host plus optional `FALCO_API_LEGACY_HOSTS` (comma-separated).
 */
export function getAllowedDocumentProxyHostnames(): string[] {
 const hosts = new Set<string>();
 hosts.add(getFalcoApiHostname());
 const legacy = process.env.FALCO_API_LEGACY_HOSTS?.trim();
 if (legacy) {
  for (const part of legacy.split(",")) {
   const host = part.trim();
   if (host) hosts.add(host);
  }
 }
 return [...hosts];
}

export function isAllowedBackendHostname(hostname: string): boolean {
 return getAllowedDocumentProxyHostnames().includes(hostname);
}

type FalcoFetchOptions = {
 method?: string;
 body?: unknown;
 token?: string | null;
 headers?: Record<string, string>;
 signal?: AbortSignal;
};

function parseErrorEnvelope(json: unknown): { message: string; code?: string; details?: FalcoApiErrorDetail[] } | null {
 if (!json || typeof json !== "object") return null;
 const err = (json as { error?: unknown }).error;
 if (!err || typeof err !== "object") return null;
 const e = err as { message?: string; code?: string; details?: FalcoApiErrorDetail[] };
 if (typeof e.message !== "string") return null;
 return { message: e.message, code: typeof e.code === "string" ? e.code : undefined, details: e.details };
}

/** Laravel-style `{ errors: { field: ["msg"] } }` on the root or under `error`. */
function parseLaravelErrors(json: unknown): FalcoApiErrorDetail[] | undefined {
 if (!json || typeof json !== "object") return undefined;
 const o = json as Record<string, unknown>;
 const errObj = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : null;
 const errors = o.errors ?? errObj?.errors;
 if (!errors || typeof errors !== "object" || Array.isArray(errors)) return undefined;
 const details: FalcoApiErrorDetail[] = [];
 for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
 const text = Array.isArray(messages) ? messages.map(String).join(", ") : String(messages);
 if (text) details.push({ field, message: text });
 }
 return details.length ? details : undefined;
}

function mergeErrorDetails(
 envelopeDetails?: FalcoApiErrorDetail[],
 laravelDetails?: FalcoApiErrorDetail[]
): FalcoApiErrorDetail[] | undefined {
 const merged = [...(envelopeDetails ?? []), ...(laravelDetails ?? [])];
 return merged.length ? merged : undefined;
}

export function formatFalcoApiError(error: FalcoApiError): string {
 const detailText = formatValidationDetails(error.details);
 const base = error.message?.trim() || "Request failed";
 if (!detailText) return base;
 if (/given data was invalid|validation failed|validation error/i.test(base)) {
 return detailText;
 }
 return `${base} — ${detailText}`;
}

/** Format Next.js API JSON (`message`, `details`, `errors`, or nested `error`). */
export function formatApiResponseError(json: unknown, fallback: string): string {
 if (!json || typeof json !== "object") return fallback;
 const o = json as Record<string, unknown>;
 const err =
 o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
 const message =
 typeof err.message === "string"
 ? err.message
 : typeof o.message === "string"
 ? o.message
 : fallback;

 const fromDetailsArray = Array.isArray(err.details)
 ? formatValidationDetails(err.details as FalcoApiErrorDetail[])
 : Array.isArray(o.details)
 ? formatValidationDetails(o.details as FalcoApiErrorDetail[])
 : "";

 let fromObject = "";
 const detailsRaw = err.details ?? o.details;
 if (detailsRaw && typeof detailsRaw === "object" && !Array.isArray(detailsRaw)) {
 const parts: string[] = [];
 for (const [field, messages] of Object.entries(detailsRaw as Record<string, unknown>)) {
 const text = Array.isArray(messages) ? messages.map(String).join(", ") : String(messages);
 parts.push(`${field}: ${text}`);
 }
 fromObject = parts.join("; ");
 }

 const laravel = formatValidationDetails(parseLaravelErrors(json));
 const detailText = fromDetailsArray || fromObject || laravel;

 if (!detailText) return message;
 if (/given data was invalid|validation failed|validation error/i.test(message)) {
 return detailText;
 }
 return `${message} — ${detailText}`;
}

/** JSON request to the Falco LMS API (server-side). */
export async function falcoFetch<T = unknown>(path: string, options: FalcoFetchOptions = {}): Promise<T> {
 const { method = "GET", body, token, headers = {}, signal } = options;
 const url = `${getFalcoApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

 const reqHeaders: Record<string, string> = {
 Accept: "application/json",
 "User-Agent": "FalcoWebsite/1.0 (Next.js)",
 ...headers,
 };
 if (body !== undefined && body !== null) {
 reqHeaders["Content-Type"] = "application/json";
 }
 if (token) {
 reqHeaders.Authorization = `Bearer ${token}`;
 }

 let response: Response;
 try {
 response = await fetch(url, {
 method,
 headers: reqHeaders,
 body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
 signal,
 cache: "no-store",
 });
 } catch (e) {
 const hint = process.env.FALCO_API_BASE_URL?.trim() || FALCO_API_CONFIG_MESSAGE;
 const detail = e instanceof Error ? e.message : "Network error";
 throw new FalcoApiError(
 `Cannot reach the Falco API (${hint}). Check your connection or FALCO_API_BASE_URL. (${detail})`,
 { status: 503, code: "NETWORK_ERROR" }
 );
 }

 const text = await response.text();
 let json: unknown = null;
 if (text) {
 try {
 json = JSON.parse(text) as unknown;
 } catch {
 json = null;
 }
 }

 if (!response.ok) {
 const envelope = json ? parseErrorEnvelope(json) : null;
 const laravelDetails = parseLaravelErrors(json);
 const legacyMessage =
 json && typeof json === "object" && "message" in json && typeof (json as { message: unknown }).message === "string"
 ? (json as { message: string }).message
 : undefined;
 throw new FalcoApiError(envelope?.message ?? legacyMessage ?? response.statusText, {
 status: response.status,
 code: envelope?.code,
 details: mergeErrorDetails(envelope?.details, laravelDetails),
 });
 }

 return json as T;
}

export function formatValidationDetails(details: FalcoApiErrorDetail[] | undefined): string {
 if (!details?.length) return "";
 return details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).filter(Boolean).join("; ");
}
