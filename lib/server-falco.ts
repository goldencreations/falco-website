import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth";
import { falcoFetch, FalcoApiError } from "@/lib/falco-api";

function accessTokenFromCookieHeader(cookieHeader: string): string | null {
 const part = cookieHeader
 .split(";")
 .map((s) => s.trim())
 .find((p) => p.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`));
 if (!part) return null;
 return decodeURIComponent(part.slice(ACCESS_TOKEN_COOKIE_NAME.length + 1));
}

export async function getFalcoAccessTokenFromCookies(): Promise<string | null> {
 const store = await cookies();
 return store.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? null;
}

/** Prefer the incoming request Cookie header, then Next.js cookie store (Route Handlers). */
export async function resolveFalcoAccessToken(request?: Request): Promise<string | null> {
 if (request) {
 const fromRequest = accessTokenFromCookieHeader(request.headers.get("cookie") ?? "");
 if (fromRequest) return fromRequest;
 }
 return getFalcoAccessTokenFromCookies();
}

export async function falcoServerFetch<T>(
 path: string,
 init?: {
 method?: string;
 body?: unknown;
 query?: Record<string, string | undefined | null>;
 headers?: Record<string, string>;
 /** Pass the Route Handler `request` so the bearer token is read from the same cookies as `requireApiUser`. */
 request?: Request;
 }
): Promise<{ ok: true; data: T } | { ok: false; error: FalcoApiError }> {
 const token = await resolveFalcoAccessToken(init?.request);
 if (!token) {
 return {
 ok: false,
 error: new FalcoApiError("Your session expired. Please sign in again.", { status: 401 }),
 };
 }
 let pathWithQuery = path.startsWith("/") ? path : `/${path}`;
 if (init?.query) {
 const params = new URLSearchParams();
 for (const [k, v] of Object.entries(init.query)) {
 if (v !== undefined && v !== null && v !== "") params.set(k, v);
 }
 const q = params.toString();
 if (q) pathWithQuery += (pathWithQuery.includes("?") ? "&" : "?") + q;
 }
 try {
 const data = await falcoFetch<T>(pathWithQuery, {
 method: init?.method ?? "GET",
 body: init?.body,
 token,
 headers: init?.headers,
 });
 return { ok: true, data };
 } catch (e) {
 if (e instanceof FalcoApiError) return { ok: false, error: e };
 const message = e instanceof Error ? e.message : "Unexpected error contacting Falco API";
 return {
 ok: false,
 error: new FalcoApiError(message, { status: 503, code: "NETWORK_ERROR" }),
 };
 }
}
