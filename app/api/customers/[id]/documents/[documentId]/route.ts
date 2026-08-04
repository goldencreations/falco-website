import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { falcoServerFetch, resolveFalcoAccessToken } from "@/lib/server-falco";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";

/**
 * Streams a single uploaded customer document/photo (`GET /customers/{customerId}/documents/{documentId}`).
 * Used to preview documents (e.g. guarantor ID scans) that only carry a document id — no
 * separately-signed URL — back from the API, so the browser never needs the backend bearer token.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> }
) {
  const { id, documentId } = await context.params;
  if (!id?.trim() || !documentId?.trim()) {
    return NextResponse.json({ message: "Customer id and document id are required" }, { status: 400 });
  }
  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  const token = await resolveFalcoAccessToken(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${getFalcoApiBaseUrl()}/customers/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch document" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { message: `Document server returned ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
  });
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { status: 200, headers });
}

/** Deletes a single uploaded customer document/photo (`DELETE /customers/{customerId}/documents/{documentId}`). */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> }
) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;
  const { id, documentId } = await context.params;
  if (!id?.trim() || !documentId?.trim()) {
    return NextResponse.json({ message: "Customer id and document id are required" }, { status: 400 });
  }

  const res = await falcoServerFetch<unknown>(
    `/customers/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE", request }
  );

  if (!res.ok) {
    return NextResponse.json(
      { message: res.error.message, details: res.error.details },
      { status: res.error.status }
    );
  }
  return new NextResponse(null, { status: 204 });
}
