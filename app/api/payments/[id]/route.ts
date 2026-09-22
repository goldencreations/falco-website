import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { enrichPaymentRowsWithContext } from "@/lib/payment-enrichment";
import { adaptPaymentViewRow } from "@/lib/payment-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 const res = await falcoServerFetch<unknown>(`/payments/${encodeURIComponent(id)}`, {
  request,
 });

 if (!res.ok) {
  const message = formatFalcoApiError(res.error);
  return NextResponse.json(
   { message, error: message, details: res.error.details },
   { status: res.error.status }
  );
 }

 const payload = res.data as Record<string, unknown>;
 const rawPayment =
  payload.payment && typeof payload.payment === "object"
   ? (payload.payment as Record<string, unknown>)
   : payload;
 const [payment] = await enrichPaymentRowsWithContext([
  adaptPaymentViewRow(rawPayment),
 ]);

 return NextResponse.json({ payment });
}
