import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: RouteContext) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;
  if (!auth.user.features?.includes("general_ledger")) {
    return NextResponse.json({ message: "Private General Ledger access is required." }, { status: 403 });
  }

  const { path } = await context.params;
  if (!path.length || path.some((part) => !/^[a-z0-9-]+$/i.test(part))) {
    return NextResponse.json({ message: "Invalid General Ledger path." }, { status: 400 });
  }

  const token = await resolveFalcoAccessToken(request);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const incomingUrl = new URL(request.url);
  const backendUrl = new URL(`${getFalcoApiBaseUrl()}/general-ledger/${path.join("/")}`);
  backendUrl.search = incomingUrl.search;
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const response = await fetch(backendUrl, {
    method,
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: request.headers.get("accept") ?? "application/json",
      ...(body ? { "Content-Type": request.headers.get("content-type") ?? "application/json" } : {}),
      "User-Agent": "FalcoWebsite/1.0 (Next.js)",
    },
    cache: "no-store",
  });

  const responseBody = await response.arrayBuffer();
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");

  return new NextResponse(responseBody, { status: response.status, headers });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
