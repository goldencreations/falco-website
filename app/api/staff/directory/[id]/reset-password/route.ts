import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/**
 * Proxies `POST /users/{userId}/reset-password`. No request body — the backend generates a new
 * temporary password, invalidates the user's existing sessions, and returns it once:
 * `{ "temporary_password": "..." }`. It is never re-exposed after this call, so the admin must
 * copy/share it immediately.
 */
export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 if (auth.user.role !== "super_admin" && !auth.user.permissions.includes("users.manage")) {
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }

 const { id } = await context.params;

 const res = await falcoServerFetch<{ temporary_password?: string }>(
 `/users/${encodeURIComponent(id)}/reset-password`,
 { method: "POST" }
 );

 if (!res.ok) {
 console.error("[POST /api/staff/directory/[id]/reset-password] backend error", {
 status: res.error.status,
 message: res.error.message,
 code: res.error.code,
 details: res.error.details,
 });
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const temporaryPassword = res.data?.temporary_password;
 if (!temporaryPassword) {
 return NextResponse.json(
 { message: "Unexpected password reset response from server" },
 { status: 502 }
 );
 }

 return NextResponse.json({ temporary_password: temporaryPassword });
}
