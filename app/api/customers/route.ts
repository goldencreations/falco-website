import { NextResponse } from "next/server";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import { patchCustomerLoanOfficerOnServer } from "@/lib/customer-assignment";
import {
 isBranchDataScoped,
 requireApiUser,
 resolvedBranchIdForListQuery,
} from "@/lib/authorization";
import { mapFormPayloadToCustomerApi } from "@/lib/customer-payload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const q = url.searchParams.get("q") ?? undefined;
 const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const risk_grade = url.searchParams.get("risk_grade") ?? undefined;
 const is_active = url.searchParams.get("is_active");
 const page = url.searchParams.get("page") ?? "1";
 const page_size = url.searchParams.get("page_size") ?? "50";

 const res = await falcoServerFetch<unknown>("/customers", {
 request,
 query: {
 q,
 branch_id,
 risk_grade,
 is_active: is_active === null || is_active === "" ? undefined : is_active,
 page,
 page_size,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}

function resolveLoanOfficerIdForCreate(
 user: { id: string; role: string },
 body: Record<string, unknown>
): string {
 if (user.role === "loan_officer") return user.id.trim();
 const fromBody = body.loan_officer_id != null ? String(body.loan_officer_id).trim() : "";
 return fromBody;
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const user = auth.user;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 if (user.role === "loan_officer" && !user.branch_id?.trim()) {
 return NextResponse.json(
 { message: "Your account is not linked to a branch. Contact an administrator." },
 { status: 400 }
 );
 }

 const officerId = resolveLoanOfficerIdForCreate(user, body);
 const apiBody = mapFormPayloadToCustomerApi(body);

 if (isBranchDataScoped(user)) {
 apiBody.branch_id = user.branch_id.trim();
 }

 const metadata =
 apiBody.metadata && typeof apiBody.metadata === "object" && apiBody.metadata !== null
 ? (apiBody.metadata as Record<string, unknown>)
 : {};
 metadata.created_by = user.id;
 if (officerId) {
 metadata.loan_officer_id = officerId;
 metadata.assigned_loan_officer_id = officerId;
 }
 apiBody.metadata = metadata;

 const res = await falcoServerFetch<unknown>("/customers", {
 method: "POST",
 body: apiBody,
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 {
 message: res.error.message,
 code: res.error.code,
 details: res.error.details,
 },
 { status: res.error.status }
 );
 }

 let responseData = res.data;
 if (officerId) {
 const createdRow = extractCustomerDetail(res.data);
 const customerId = createdRow?.id != null ? String(createdRow.id) : "";
 if (customerId) {
 const assigned = await patchCustomerLoanOfficerOnServer(request, customerId, officerId);
 if (assigned.ok) {
 responseData = {
 ...(typeof res.data === "object" && res.data !== null ? res.data : {}),
 customer: assigned.customer,
 };
 }
 }
 }

 return NextResponse.json(responseData);
}
