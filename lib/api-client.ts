import { withCacheBypass } from "@/lib/client-fetch-cache";

/** Authenticated calls to this app's `/api/*` routes (cookies + no stale GET cache). */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
 return fetch(
 input,
 withCacheBypass({
 credentials: "include",
 cache: "no-store",
 ...init,
 headers: init?.headers,
 })
 );
}

export function apiErrorMessage(json: unknown, fallback: string): string {
 if (!json || typeof json !== "object") return fallback;
 const o = json as Record<string, unknown>;
 if (typeof o.message === "string" && o.message.trim()) return o.message;
 if (typeof o.error === "string" && o.error.trim()) return o.error;
 return fallback;
}

export function isSessionExpiredResponse(status: number, message: string): boolean {
 if (status !== 401) return false;
 return /session expired|sign in again|unauthorized/i.test(message);
}
