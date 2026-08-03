import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

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
