import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { extractProductsList } from "@/lib/product-adapters";
import { buildProductCreateApiBody } from "@/lib/product-payload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const isActiveParam = url.searchParams.get("is_active");

 async function loadProducts(is_active?: string | null) {
 return falcoServerFetch<unknown>("/products", {
 query: is_active === null || is_active === "" ? undefined : { is_active },
 });
 }

 let res = await loadProducts(isActiveParam);
 if (!res.ok && isActiveParam) {
 res = await loadProducts(null);
 }

 if (!res.ok) {
 const needsProductView =
 res.error.status === 403 &&
 !auth.user.permissions.includes("products.view") &&
 !auth.user.permissions.includes("products.manage") &&
 auth.user.role !== "super_admin";
 const message = needsProductView
 ? "Your account cannot list loan products. Ask an administrator to grant products.view (or products.manage) for application creation."
 : res.error.message;
 return NextResponse.json(
 {
 message,
 error: message,
 products: [],
 details: res.error.details,
 },
 { status: res.error.status }
 );
 }

 const products = extractProductsList(res.data);
 return NextResponse.json({ products, data: products });
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let raw: Record<string, unknown>;
 try {
 raw = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const apiBody = buildProductCreateApiBody(raw);
 const res = await falcoServerFetch<unknown>("/products", {
 method: "POST",
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
