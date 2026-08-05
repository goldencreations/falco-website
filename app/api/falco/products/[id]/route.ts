import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { buildProductCreateApiBody } from "@/lib/product-payload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function PATCH(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id) {
 return NextResponse.json({ message: "Product not found" }, { status: 404 });
 }

 let raw: Record<string, unknown>;
 try {
 raw = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid request" }, { status: 400 });
 }

 const apiBody = buildProductCreateApiBody(raw);
 const res = await falcoServerFetch<unknown>(`/products/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: apiBody,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, code: res.error.code, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}
