import { NextResponse } from "next/server";
import {
 extractPaymentsPayload,
 mapUiPaymentCreateToApi,
} from "@/lib/payment-adapters";
import { enrichPaymentRowsWithContext } from "@/lib/payment-enrichment";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "200",
 loan_id: url.searchParams.get("loan_id") ?? undefined,
 customer_id: url.searchParams.get("customer_id") ?? undefined,
 status: url.searchParams.get("status") ?? undefined,
 from: url.searchParams.get("from") ?? undefined,
 to: url.searchParams.get("to") ?? undefined,
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 },
 });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
 { status: res.error.status }
 );
 }

 const payload = extractPaymentsPayload(res.data);
 const payments = await enrichPaymentRowsWithContext(payload.payments);

 return NextResponse.json({
 data: payments,
 payments,
 meta: payload.meta ?? null,
 });
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

 const mapped = mapUiPaymentCreateToApi(body);
 const amount = Number(mapped.amount);
 if (!Number.isFinite(amount) || amount <= 0) {
 return NextResponse.json(
 {
 message: "amount must be a positive number",
 error: "amount must be a positive number",
 details: [{ field: "amount", message: "Enter a valid payment amount." }],
 },
 { status: 400 }
 );
 }

 const res = await falcoServerFetch<unknown>("/payments", {
 method: "POST",
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
