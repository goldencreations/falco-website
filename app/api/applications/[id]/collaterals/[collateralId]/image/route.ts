import {
  proxyApplicationMultipartUpload,
  verifyApplicationUploadAccess,
} from "@/lib/server-application-upload";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; collateralId: string }> }
) {
  const { id, collateralId } = await context.params;
  const denied = await verifyApplicationUploadAccess(request, id);
  if (denied) return denied;

  return proxyApplicationMultipartUpload(
    request,
    `/applications/${encodeURIComponent(id)}/collaterals/${encodeURIComponent(collateralId)}/image`
  );
}
