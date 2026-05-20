import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

/** Proxies `GET /backups/export?format=csv` — returns raw CSV from LMS. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const format = (url.searchParams.get("format") || "csv").toLowerCase();

 if (format !== "csv") {
 return NextResponse.json(
 { message: "Only CSV export is supported by the LMS backup export endpoint." },
 { status: 400 }
 );
 }

 const token = await resolveFalcoAccessToken(request);
 if (!token) {
 return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
 }

 const res = await fetch(`${getFalcoApiBaseUrl()}/backups/export?format=csv`, {
 method: "GET",
 headers: {
 Authorization: `Bearer ${token}`,
 Accept: "text/csv, application/json",
 "User-Agent": "FalcoWebsite/1.0 (Next.js)",
 },
 cache: "no-store",
 });

 const text = await res.text();
 if (!res.ok) {
 let message = "Export failed";
 try {
 const j = JSON.parse(text) as { message?: string; error?: { message?: string } };
 message =
 typeof j.message === "string"
 ? j.message
 : typeof j.error?.message === "string"
 ? j.error.message
 : message;
 } catch {
 if (text) message = text.slice(0, 200);
 }
 return NextResponse.json({ message }, { status: res.status });
 }

 return new NextResponse(text, {
 status: 200,
 headers: {
 "Content-Type": "text/csv; charset=utf-8",
 "Content-Disposition": `attachment; filename="backups-export-${Date.now()}.csv"`,
 },
 });
}
