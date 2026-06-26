import { NextResponse } from "next/server";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import { buildCustomerCollateralImageLinkPatch } from "@/lib/customer-collateral";
import {
  CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE,
  extractUploadedDocumentId,
  uploadCustomerDocument,
} from "@/lib/server-customer-documents";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; collateralId: string }> }
) {
  const { id, collateralId } = await context.params;
  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  const name = String(incoming.get("name") ?? file.name).trim() || file.name;

  const uploaded = await uploadCustomerDocument(request, id, {
    file,
    type: CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE,
    name,
    collateralId,
  });
  if (!uploaded.ok) return uploaded.response;

  const documentId = extractUploadedDocumentId(uploaded.data);
  if (!documentId) {
    const detailRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
      request,
    });
    if (detailRes.ok) {
      const row = extractCustomerDetail(detailRes.data);
      const collaterals = row ? (row.collateral ?? row.collaterals) : null;
      const hasImage = Array.isArray(collaterals)
        ? collaterals.some((item) => {
            if (!item || typeof item !== "object") return false;
            const o = item as Record<string, unknown>;
            if (String(o.id ?? "") !== collateralId) return false;
            const attachmentCount =
              (Array.isArray(o.collateral_image_attachments)
                ? o.collateral_image_attachments.length
                : 0) +
              (Array.isArray(o.collaterall_image_attachment)
                ? o.collaterall_image_attachment.length
                : 0) +
              (Array.isArray(o.image_document_ids) ? o.image_document_ids.length : 0);
            return Boolean(
              o.image_document ||
                o.image_document_id ||
                o.image_url ||
                attachmentCount > 0
            );
          })
        : false;
      if (hasImage) {
        return NextResponse.json(uploaded.data ?? { ok: true });
      }
    }

    return NextResponse.json(
      {
        message:
          "Collateral image uploaded but could not be linked to the collateral record. Refresh and try again.",
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

  const patchBody = buildCustomerCollateralImageLinkPatch(row, collateralId, documentId);
  if (!patchBody) {
    return NextResponse.json({ message: "Collateral record not found on customer" }, { status: 404 });
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
