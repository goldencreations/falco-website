import { NextResponse } from "next/server";
import { uploadCustomerGuarantorIdScan } from "@/lib/server-customer-documents";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";

/**
 * `POST /customers/{customerId}/guarantors/{guarantorId}/id-back` — uploads the guarantor's ID
 * back scan directly through the dedicated backend endpoint, which links the resulting document
 * to the guarantor record itself. Response: `{ document: { id, type, name } }`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; guarantorId: string }> }
) {
  const { id, guarantorId } = await context.params;
  if (!id?.trim() || !guarantorId?.trim()) {
    return NextResponse.json({ message: "Customer id and guarantor id are required" }, { status: 400 });
  }
  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  const incoming = await request.formData();
  const file = incoming.get("file") ?? incoming.get("document");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  const uploaded = await uploadCustomerGuarantorIdScan(request, id, guarantorId, "id-back", file);
  if (!uploaded.ok) return uploaded.response;

  return NextResponse.json(uploaded.data ?? { ok: true });
}
