import { NextResponse } from "next/server";
import { sanitizeApplicationBodyFromClient } from "@/lib/application-payload";
import { shouldSoftEmptyApiError } from "@/lib/api-soft-fallback";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/applications", {
 request,
 query: {
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "50",
 status: url.searchParams.get("status") ?? undefined,
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 },
 });

 if (!res.ok) {
 if (shouldSoftEmptyApiError(auth.user, res.error.status)) {
 return NextResponse.json({ data: [], _fallback: true, message: res.error.message });
 }
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }
 const res = await falcoServerFetch<unknown>("/applications", {
 request,
 method: "POST",
 body: sanitizeApplicationBodyFromClient(body),
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
