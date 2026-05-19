import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { mapUiLeadCreateToApi } from "@/lib/lead-adapters";
import { resolveLeadCreateBranchId } from "@/lib/lead-branch";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));

 const res = await falcoServerFetch<unknown>("/leads", {
 request,
 query: {
 q: url.searchParams.get("q") ?? undefined,
 status: url.searchParams.get("status") ?? undefined,
 branch_id: branchId,
 created_by:
 auth.user.role === "loan_officer"
 ? auth.user.id
 : url.searchParams.get("created_by") ?? undefined,
 follow_up_from: url.searchParams.get("follow_up_from") ?? undefined,
 follow_up_to: url.searchParams.get("follow_up_to") ?? undefined,
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "100",
 },
 });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
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
 return NextResponse.json({ message: "Invalid JSON", error: "Invalid JSON" }, { status: 400 });
 }

 const mapped: Record<string, unknown> =
 body.full_name != null
 ? { ...body }
 : mapUiLeadCreateToApi({
 fullName: String(body.fullName ?? ""),
 phoneNumber: String(body.phoneNumber ?? ""),
 alternatePhone: body.alternatePhone ? String(body.alternatePhone) : undefined,
 locationType: (body.locationType as "home" | "work" | "sponsor") ?? "home",
 locationName: String(body.locationName ?? ""),
 region: body.region ? String(body.region) : undefined,
 district: body.district ? String(body.district) : undefined,
 ward: body.ward ? String(body.ward) : undefined,
 latitude: body.latitude ? String(body.latitude) : undefined,
 longitude: body.longitude ? String(body.longitude) : undefined,
 notes: body.notes ? String(body.notes) : undefined,
 followUpDate: body.followUpDate ? String(body.followUpDate) : undefined,
 status: body.status as "new" | "follow_up" | "contacted" | "converted" | undefined,
 });

 const branch = resolveLeadCreateBranchId(auth.user, body);
 if ("error" in branch) {
 return NextResponse.json(
 { message: branch.error, error: branch.error },
 { status: 422 }
 );
 }
 mapped.branch_id = branch.branchId;

 const res = await falcoServerFetch<unknown>("/leads", {
 method: "POST",
 request,
 body: mapped,
 });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data, { status: 201 });
}
