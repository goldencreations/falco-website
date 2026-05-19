import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /backups/flow`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const res = await falcoServerFetch<unknown>("/backups/flow", { request });
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
