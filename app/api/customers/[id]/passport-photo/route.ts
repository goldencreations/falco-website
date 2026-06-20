import {
  proxyCustomerMultipartUpload,
  verifyCustomerUploadAccess,
} from "@/lib/server-customer-upload";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const denied = await verifyCustomerUploadAccess(request, id);
  if (denied) return denied;

  return proxyCustomerMultipartUpload(
    request,
    `/customers/${encodeURIComponent(id)}/passport-photo`
  );
}
