import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `POST /backups` — create backup job record. */
export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 if (body.notify_user_id != null && body.notify_user_id !== "") {
 const n = Number(body.notify_user_id);
 if (Number.isFinite(n)) body.notify_user_id = n;
 else delete body.notify_user_id;
 }

 const res = await falcoServerFetch<unknown>("/backups", {
 method: "POST",
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
