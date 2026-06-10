import { NextResponse } from "next/server";
import { sanitizeApplicationBodyFromClient } from "@/lib/application-payload";
import {
  debugApplicationCreate,
  summarizeApplicationBody,
} from "@/lib/application-debug";
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
 debugApplicationCreate("POST /api/applications — invalid JSON");
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const sanitized = sanitizeApplicationBodyFromClient(body);
 debugApplicationCreate("POST /api/applications — request", {
  user_id: auth.user.id,
  role: auth.user.role,
  branch_id: auth.user.branch_id,
  body: summarizeApplicationBody(body),
  sanitized: summarizeApplicationBody(sanitized),
 });

 const res = await falcoServerFetch<unknown>("/applications", {
 request,
 method: "POST",
 body: sanitized,
 });

 if (!res.ok) {
 debugApplicationCreate("POST /api/applications — backend error", {
  status: res.error.status,
  message: res.error.message,
  details: res.error.details,
 });
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const data = res.data;
 const createdId =
  data && typeof data === "object"
   ? String(
      (data as Record<string, unknown>).id ??
       ((data as Record<string, unknown>).application as Record<string, unknown> | undefined)?.id ??
       ""
     ) || undefined
   : undefined;
 debugApplicationCreate("POST /api/applications — success", {
  application_id: createdId,
  response_keys: data && typeof data === "object" ? Object.keys(data as object) : [],
 });

 return NextResponse.json(res.data);
}
