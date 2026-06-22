import { NextResponse } from "next/server";
import {
  CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE,
  uploadCustomerDocument,
} from "@/lib/server-customer-documents";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}/documents`, {
      method: "POST",
      body,
      request,
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: res.error.message, details: res.error.details },
        { status: res.error.status }
      );
    }
    return NextResponse.json(res.data ?? { ok: true });
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  const type = String(incoming.get("type") ?? CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE).trim();
  const name = String(incoming.get("name") ?? file.name).trim() || file.name;
  const collateralId = String(incoming.get("collateral_id") ?? "").trim() || undefined;

  const uploaded = await uploadCustomerDocument(request, id, {
    file,
    type,
    name,
    collateralId,
  });
  if (!uploaded.ok) return uploaded.response;
  return NextResponse.json(uploaded.data ?? { ok: true });
}
