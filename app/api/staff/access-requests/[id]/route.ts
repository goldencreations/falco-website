import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function PATCH(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request, ["super_admin"]);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 const body = (await request.json()) as Record<string, unknown>;

 const res = await falcoServerFetch<unknown>(`/users/access-requests/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: {
 status: body.status,
 notes: body.resolution_notes ?? body.notes ?? null,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
