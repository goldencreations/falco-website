import { NextResponse } from "next/server";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";
import { falcoServerFetch } from "@/lib/server-falco";

/**
 * `DELETE /customers/{customerId}/guarantors/{guarantorId}` — explicit guarantor removal.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; guarantorId: string }> }
) {
  const { id, guarantorId } = await context.params;
  if (!id?.trim() || !guarantorId?.trim()) {
    return NextResponse.json({ message: "Customer id and guarantor id are required" }, { status: 400 });
  }

  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  const res = await falcoServerFetch<unknown>(
    `/customers/${encodeURIComponent(id)}/guarantors/${encodeURIComponent(guarantorId)}`,
    {
      method: "DELETE",
      request,
    }
  );
  if (!res.ok) {
    return NextResponse.json(
      { message: res.error.message, details: res.error.details },
      { status: res.error.status }
    );
  }

  return new NextResponse(null, { status: 204 });
}

