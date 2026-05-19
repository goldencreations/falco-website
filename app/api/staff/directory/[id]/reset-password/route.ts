import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

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
 let body: unknown = undefined;
 try {
 const text = await request.text();
 if (text) body = JSON.parse(text) as unknown;
 } catch {
 body = undefined;
 }

 const res = await falcoServerFetch<unknown>(`/users/${encodeURIComponent(id)}/reset-password`, {
 method: "POST",
 body: body ?? {},
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json({ ok: true }, { status: 202 });
}
