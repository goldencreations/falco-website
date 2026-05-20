import { falcoFetch, FalcoApiError } from "@/lib/falco-api";
import type { ApiMeUser } from "@/lib/auth";

export type StaffLoginApiResponse = {
 ok?: boolean;
 access_token?: string;
 tokens?: { access_token?: string; expires_in?: number };
 token_type?: string;
 user?: ApiMeUser;
};

/**
 * POST `/api/login`, then `/auth/login` if the first fails with a retryable error
 * (see `backend-documentation/auth-controller.md`).
 */
export async function postStaffLoginToApi(body: {
 email: string;
 password: string;
 rememberMe?: boolean;
}): Promise<StaffLoginApiResponse> {
 const paths = ["/api/login", "/auth/login"] as const;
 let lastError: unknown;
 for (const path of paths) {
 try {
 const raw = await falcoFetch<unknown>(path, { method: "POST", body });
 return normalizeStaffLoginPayload(raw);
 } catch (e) {
 lastError = e;
 if (e instanceof FalcoApiError) {
 if (e.status === 401 || e.status === 403 || e.status === 422) throw e;
 continue;
 }
 continue;
 }
 }
 throw lastError instanceof Error ? lastError : new Error("Login request failed");
}

/** Accepts documented shape or common `{ data: { ... } }` wrappers. */
export function normalizeStaffLoginPayload(json: unknown): StaffLoginApiResponse {
 if (!json || typeof json !== "object") return {};
 const r = json as Record<string, unknown>;

 let user = r.user as ApiMeUser | undefined;
 let access_token = r.access_token as string | undefined;
 let tokens = r.tokens as StaffLoginApiResponse["tokens"];

 const data = r.data;
 if (data && typeof data === "object") {
 const d = data as Record<string, unknown>;
 user = (user ?? d.user) as ApiMeUser | undefined;
 access_token =
 access_token ??
 (typeof d.access_token === "string" ? d.access_token : undefined) ??
 (d.tokens &&
 typeof d.tokens === "object" &&
 typeof (d.tokens as { access_token?: unknown }).access_token === "string"
 ? ((d.tokens as { access_token: string }).access_token as string)
 : undefined);
 tokens = tokens ?? (d.tokens as StaffLoginApiResponse["tokens"]);
 }

 return {
 ok: typeof r.ok === "boolean" ? r.ok : undefined,
 access_token,
 tokens,
 token_type: typeof r.token_type === "string" ? r.token_type : undefined,
 user,
 };
}
