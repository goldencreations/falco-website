import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { normalizeBackupsPayload } from "@/lib/backup-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /backups` (see `backend-documentation/backups-controller.md`). */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const res = await falcoServerFetch<unknown>("/backups", { request });
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const normalized = normalizeBackupsPayload(res.data);
 return NextResponse.json(normalized);
}
