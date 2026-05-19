import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /groups/{group}` and `PATCH /groups/{group}`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await params;
 const res = await falcoServerFetch<unknown>(`/groups/${encodeURIComponent(id)}`, { request });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await params;
 let body: unknown;
 try {
 body = await request.json();
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(`/groups/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body,
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
