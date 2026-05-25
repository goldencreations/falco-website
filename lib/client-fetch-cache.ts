/** Header stripped before the request reaches the server — forces a fresh GET. */
export const FALCO_CACHE_BYPASS_HEADER = "x-falco-cache-bypass";

/** How long cached GET responses stay valid (navigation back uses cache within this window). */
export const FETCH_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheRecord = {
 body: string;
 status: number;
 statusText: string;
 headers: [string, string][];
 expiresAt: number;
};

const memoryStore = new Map<string, CacheRecord>();
const SESSION_PREFIX = "falco-fetch-cache:";

let nativeFetch: typeof fetch | null = null;
let patchInstalled = false;

function resolveUrl(input: RequestInfo | URL): string {
 if (typeof input === "string") return input;
 if (input instanceof URL) return input.href;
 return input.url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
 if (init?.method) return init.method.toUpperCase();
 if (typeof input !== "string" && !(input instanceof URL) && input.method) {
 return input.method.toUpperCase();
 }
 return "GET";
}

function resolveCredentials(input: RequestInfo | URL, init?: RequestInit): RequestCredentials {
 if (init?.credentials) return init.credentials;
 if (typeof input !== "string" && !(input instanceof URL) && "credentials" in input) {
 return (input as Request).credentials;
 }
 return "same-origin";
}

function cacheKey(input: RequestInfo | URL, init?: RequestInit): string {
 const url = resolveUrl(input);
 const method = resolveMethod(input, init);
 const credentials = resolveCredentials(input, init);
 return `${method}:${credentials}:${url}`;
}

function hasBypassHeader(init?: RequestInit): boolean {
 if (!init?.headers) return false;
 const headers = new Headers(init.headers);
 return headers.get(FALCO_CACHE_BYPASS_HEADER) === "1";
}

function stripBypassHeader(init?: RequestInit): RequestInit | undefined {
 if (!init?.headers) return init;
 const headers = new Headers(init.headers);
 if (!headers.has(FALCO_CACHE_BYPASS_HEADER)) return init;
 headers.delete(FALCO_CACHE_BYPASS_HEADER);
 return { ...init, headers };
}

function readSessionRecord(key: string): CacheRecord | null {
 if (typeof window === "undefined") return null;
 try {
 const raw = sessionStorage.getItem(`${SESSION_PREFIX}${key}`);
 if (!raw) return null;
 const parsed = JSON.parse(raw) as CacheRecord;
 if (Date.now() >= parsed.expiresAt) {
 sessionStorage.removeItem(`${SESSION_PREFIX}${key}`);
 return null;
 }
 return parsed;
 } catch {
 return null;
 }
}

function writeSessionRecord(key: string, record: CacheRecord) {
 if (typeof window === "undefined") return;
 try {
 sessionStorage.setItem(`${SESSION_PREFIX}${key}`, JSON.stringify(record));
 } catch {
 /* quota — memory cache still works */
 }
}

function removeSessionRecord(key: string) {
 if (typeof window === "undefined") return;
 try {
 sessionStorage.removeItem(`${SESSION_PREFIX}${key}`);
 } catch {
 /* ignore */
 }
}

function recordFromResponse(body: string, response: Response, expiresAt: number): CacheRecord {
 return {
 body,
 status: response.status,
 statusText: response.statusText,
 headers: [...response.headers.entries()],
 expiresAt,
 };
}

function responseFromRecord(record: CacheRecord): Response {
 return new Response(record.body, {
 status: record.status,
 statusText: record.statusText,
 headers: record.headers,
 });
}

function getCachedRecord(key: string): CacheRecord | null {
 const hit = memoryStore.get(key);
 if (hit && Date.now() < hit.expiresAt) return hit;
 if (hit) memoryStore.delete(key);

 const sessionHit = readSessionRecord(key);
 if (sessionHit) {
 memoryStore.set(key, sessionHit);
 return sessionHit;
 }
 return null;
}

function setCachedRecord(key: string, record: CacheRecord) {
 memoryStore.set(key, record);
 writeSessionRecord(key, record);
}

/** Drop cached GET entries. Pass a URL prefix (e.g. `/api/payments`) or omit to clear all. */
export function invalidateFetchCache(urlPrefix?: string) {
 if (!urlPrefix) {
 memoryStore.clear();
 if (typeof window !== "undefined") {
 for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
 const k = sessionStorage.key(i);
 if (k?.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k);
 }
 }
 return;
 }

 for (const key of [...memoryStore.keys()]) {
 if (key.includes(urlPrefix)) {
 memoryStore.delete(key);
 removeSessionRecord(key);
 }
 }

 if (typeof window !== "undefined") {
 for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
 const k = sessionStorage.key(i);
 if (k?.startsWith(SESSION_PREFIX) && k.includes(urlPrefix)) {
 sessionStorage.removeItem(k);
 }
 }
 }
}

function invalidateForMutation(url: string) {
 try {
 const pathname = new URL(url, "http://local").pathname;
 const parts = pathname.split("/").filter(Boolean);
 if (parts.length >= 2) {
 invalidateFetchCache(`/${parts[0]}/${parts[1]}`);
 }
 } catch {
 invalidateFetchCache("/api");
 }
}

/** Merge into fetch init to skip cache (manual refresh buttons). */
export function withCacheBypass(init?: RequestInit): RequestInit {
 const headers = new Headers(init?.headers);
 headers.set(FALCO_CACHE_BYPASS_HEADER, "1");
 return { ...init, headers };
}

/** Clear cache then run a loader — use on explicit Refresh actions. */
export function forceCachedReload(run: () => void | Promise<void>) {
 invalidateFetchCache();
 void run();
}

async function cachedFetchImpl(
 input: RequestInfo | URL,
 init?: RequestInit,
 fetchFn: typeof fetch = fetch
): Promise<Response> {
 const method = resolveMethod(input, init);
 const url = resolveUrl(input);
 const bypass = hasBypassHeader(init);
 const cleanInit = stripBypassHeader(init);

 if (method !== "GET") {
 const response = await fetchFn(input, cleanInit);
 if (response.ok) invalidateForMutation(url);
 return response;
 }

 const key = cacheKey(input, cleanInit);
 if (!bypass) {
 const hit = getCachedRecord(key);
 if (hit) return responseFromRecord(hit);
 }

 const response = await fetchFn(input, { ...cleanInit, cache: "no-store" });
 const body = await response.clone().text();

 if (response.ok) {
 setCachedRecord(
 key,
 recordFromResponse(body, response, Date.now() + FETCH_CACHE_TTL_MS)
 );
 }

 return new Response(body, {
 status: response.status,
 statusText: response.statusText,
 headers: response.headers,
 });
}

/** Cached GET fetch — safe to call directly instead of `fetch` for reads. */
export async function cachedFetch(
 input: RequestInfo | URL,
 init?: RequestInit
): Promise<Response> {
 const fetchFn = nativeFetch ?? fetch;
 return cachedFetchImpl(input, init, fetchFn);
}

/** Install a global fetch wrapper so existing pages benefit without edits. */
export function installFetchCachePatch() {
 if (patchInstalled || typeof window === "undefined") return;
 nativeFetch = window.fetch.bind(window);
 window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
 cachedFetchImpl(input, init, nativeFetch!)) as typeof fetch;
 patchInstalled = true;
}
