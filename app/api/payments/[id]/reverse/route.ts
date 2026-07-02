import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const mayReverse =
 auth.user.role === "super_admin" ||
 auth.user.role === "accountant" ||
 auth.user.permissions?.includes("payments.reverse");
 if (!mayReverse) {
 return NextResponse.json(
 { message: "You do not have permission to reverse payments." },
 { status: 403 }
 );
 }

 const { id } = await context.params;
 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const reason = String(body.reason ?? "").trim();
 if (!reason) {
 return NextResponse.json(
 { message: "A reversal reason is required.", details: [{ field: "reason", message: "Enter a reason." }] },
 { status: 400 }
 );
 }

 const res = await falcoServerFetch<unknown>(
 `/payments/${encodeURIComponent(id)}/reverse`,
 { method: "POST", body: { reason } }
 );
 if (!res.ok) {
 const message = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message, error: message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}
