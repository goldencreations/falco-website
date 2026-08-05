import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

const SUPPORTED = new Set([
  "portfolio-summary",
  "aging",
  "disbursements",
  "collections",
  "customer-demographics",
  "application-performance",
  "branch-performance",
  "expected-collections",
  "loan-product-performance",
  "group-performance",
  "financial-summary",
]);

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;
  const { type } = await context.params;
  if (!SUPPORTED.has(type)) return NextResponse.json({ message: "Unsupported report export." }, { status: 404 });

  const token = await resolveFalcoAccessToken(request);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams(incoming);
  const branchId = resolvedBranchIdForListQuery(auth.user, incoming.get("branch_id"));
  if (branchId) params.set("branch_id", branchId); else params.delete("branch_id");

  const response = await fetch(`${getFalcoApiBaseUrl()}/reports/${type}/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "*/*", "User-Agent": "FalcoWebsite/1.0 (Next.js)" },
    cache: "no-store",
  });
  const body = await response.arrayBuffer();
  if (!response.ok) {
    let message = "Export failed";
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch { /* Backend may return plain text. */ }
    return NextResponse.json({ message }, { status: response.status });
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="${type}.${incoming.get("format") ?? "csv"}"`,
    },
  });
}
