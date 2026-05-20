import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Super admin removes a customer from the active registry (`POST /customers/{id}/deactivate`). */
export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request, ["super_admin"]);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id?.trim()) {
 return NextResponse.json({ message: "Customer id is required" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(
 `/customers/${encodeURIComponent(id)}/deactivate`,
 { method: "POST", body: {} }
 );

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data ?? { ok: true });
}
