import { NextResponse } from "next/server";
import {
  CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE,
  uploadCustomerDocument,
} from "@/lib/server-customer-documents";
import { verifyCustomerUploadAccess } from "@/lib/server-customer-upload";
import { falcoServerFetch } from "@/lib/server-falco";

function collectFiles(incoming: FormData): File[] {
  // Prefer `files[]` / `files`. Only fall back to `file` when those are empty so a
  // client that accidentally sends both shapes does not create duplicate uploads.
  const files: File[] = [];
  for (const key of ["files[]", "files"]) {
    for (const value of incoming.getAll(key)) {
      if (value instanceof File && value.size > 0) files.push(value);
    }
  }
  if (files.length > 0) return files;
  for (const value of incoming.getAll("file")) {
    if (value instanceof File && value.size > 0) files.push(value);
  }
  return files;
}

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
  const files = collectFiles(incoming);
  if (files.length === 0) {
    return NextResponse.json({ message: "file or files[] is required" }, { status: 400 });
  }

  const type = String(incoming.get("type") ?? CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE).trim();
  const name = String(incoming.get("name") ?? files[0].name).trim() || files[0].name;
  const collateralId = String(incoming.get("collateral_id") ?? "").trim() || undefined;
  const guarantorId = String(incoming.get("guarantor_id") ?? "").trim() || undefined;

  const uploaded = await uploadCustomerDocument(request, id, {
    files,
    type,
    name,
    collateralId,
    guarantorId,
  });
  if (!uploaded.ok) return uploaded.response;
  return NextResponse.json(uploaded.data ?? { ok: true });
}
