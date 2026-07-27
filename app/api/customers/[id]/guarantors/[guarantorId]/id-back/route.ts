import { NextResponse } from "next/server";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import { buildCustomerGuarantorDocumentLinkPatch } from "@/lib/customer-guarantors";
import {
  CUSTOMER_GUARANTOR_ID_BACK_DOCUMENT_TYPE,
  extractUploadedDocumentId,
  uploadCustomerDocument,
} from "@/lib/server-customer-documents";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; guarantorId: string }> }
) {
  const { id, guarantorId } = await context.params;
  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  const name = String(incoming.get("name") ?? file.name).trim() || file.name;

  const uploaded = await uploadCustomerDocument(request, id, {
    files: [file],
    type: CUSTOMER_GUARANTOR_ID_BACK_DOCUMENT_TYPE,
    name,
    guarantorId,
  });
  if (!uploaded.ok) return uploaded.response;

  const documentId = extractUploadedDocumentId(uploaded.data);
  if (!documentId) {
    return NextResponse.json(
      {
        message:
          "Guarantor ID back uploaded but could not be linked to the guarantor record. Refresh and try again.",
      },
      { status: 502 }
    );
  }

  const detailRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
    request,
  });
  if (!detailRes.ok) {
    return NextResponse.json(
      { message: detailRes.error.message, details: detailRes.error.details },
      { status: detailRes.error.status }
    );
  }

  const row = extractCustomerDetail(detailRes.data);
  if (!row) {
    return NextResponse.json({ message: "Customer detail could not be read" }, { status: 502 });
  }

  const patchBody = buildCustomerGuarantorDocumentLinkPatch(
    row,
    guarantorId,
    "id_back_document_id",
    documentId
  );
  if (!patchBody) {
    return NextResponse.json({ message: "Guarantor record not found on customer" }, { status: 404 });
  }

  const patchRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patchBody,
    request,
  });
  if (!patchRes.ok) {
    return NextResponse.json(
      { message: patchRes.error.message, details: patchRes.error.details },
      { status: patchRes.error.status }
    );
  }

  return NextResponse.json(patchRes.data ?? { ok: true });
}
