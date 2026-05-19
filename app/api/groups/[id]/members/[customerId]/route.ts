import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `DELETE /groups/{group}/members/{customer}`. */
export async function DELETE(
 request: Request,
 { params }: { params: Promise<{ id: string; customerId: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id, customerId } = await params;
 const res = await falcoServerFetch<unknown>(
 `/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(customerId)}`,
 { method: "DELETE", request }
 );

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
