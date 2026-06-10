import {
  proxyApplicationMultipartUpload,
  verifyApplicationUploadAccess,
} from "@/lib/server-application-upload";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; guarantorId: string }> }
) {
  const { id, guarantorId } = await context.params;
  const denied = await verifyApplicationUploadAccess(request, id);
  if (denied) return denied;

  return proxyApplicationMultipartUpload(
    request,
    `/applications/${encodeURIComponent(id)}/guarantors/${encodeURIComponent(guarantorId)}/id-front`
  );
}
