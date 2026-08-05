import { NextResponse } from "next/server";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

export {
  CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE,
  CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_SUPPORTING_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_PASSPORT_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_COLLATERAL_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_ID_FRONT_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_ID_BACK_DOCUMENT_TYPE,
} from "@/lib/customer-document-types";

/** Read a document id from Falco customer/application document upload responses. */
export function extractUploadedDocumentId(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;

  if (o.document && typeof o.document === "object") {
    const id = (o.document as Record<string, unknown>).id;
    if (id != null && String(id).trim()) return String(id).trim();
  }

  if (Array.isArray(o.documents) && o.documents.length > 0) {
    const last = o.documents[o.documents.length - 1];
    if (last && typeof last === "object") {
      const id = (last as Record<string, unknown>).id;
      if (id != null && String(id).trim()) return String(id).trim();
    }
  }

  const nested =
    o.customer && typeof o.customer === "object"
      ? (o.customer as Record<string, unknown>)
      : null;
  if (nested && Array.isArray(nested.documents) && nested.documents.length > 0) {
    const last = nested.documents[nested.documents.length - 1];
    if (last && typeof last === "object") {
      const id = (last as Record<string, unknown>).id;
      if (id != null && String(id).trim()) return String(id).trim();
    }
  }

  if (o.id != null && String(o.id).trim()) return String(o.id).trim();
  return null;
}

/**
 * Uploads a guarantor ID scan via the dedicated backend endpoint
 * `POST /customers/{customerId}/guarantors/{guarantorId}/id-front|id-back`, which links the
 * resulting document to the guarantor record server-side — no separate PATCH needed.
 */
export async function uploadCustomerGuarantorIdScan(
  request: Request,
  customerId: string,
  guarantorId: string,
  side: "id-front" | "id-back",
  file: File
): Promise<{ ok: true; documentId: string | null; data: unknown } | { ok: false; response: Response }> {
  const token = await resolveFalcoAccessToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, response: NextResponse.json({ message: "file is required" }, { status: 400 }) };
  }

  const label = side === "id-front" ? "Guarantor ID front" : "Guarantor ID back";
  const form = new FormData();
  form.append("file", file, file.name);

  try {
    const res = await fetch(
      `${getFalcoApiBaseUrl()}/customers/${encodeURIComponent(customerId)}/guarantors/${encodeURIComponent(guarantorId)}/${side}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: form,
        cache: "no-store",
      }
    );

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
      return {
        ok: false,
        response: NextResponse.json(
          {
            message:
              typeof err.message === "string"
                ? err.message
                : typeof o.message === "string"
                  ? o.message
                  : `${label} upload failed`,
            details: err.details ?? o.details,
          },
          { status: res.status }
        ),
      };
    }

    return { ok: true, documentId: extractUploadedDocumentId(data), data: data ?? { ok: true } };
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Could not reach the document service. Try a smaller file or try again.";
    return { ok: false, response: NextResponse.json({ message }, { status: 502 }) };
  }
}

export type CustomerDocumentUploadFields = {
  files: File[];
  type: string;
  name?: string;
  collateralId?: string;
  guarantorId?: string;
};

/**
 * Proxy multipart upload to `POST /customers/{id}/documents`.
 * Send only `files[]` — also appending `file` for single uploads made backends that
 * accept both shapes store the same photo twice.
 */
export async function uploadCustomerDocument(
  request: Request,
  customerId: string,
  fields: CustomerDocumentUploadFields
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const token = await resolveFalcoAccessToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const files = fields.files.filter((f) => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ message: "At least one file is required" }, { status: 400 }),
    };
  }

  const form = new FormData();
  form.append("type", fields.type);
  form.append("name", fields.name?.trim() || files[0].name);
  for (const file of files) {
    form.append("files[]", file, file.name);
  }
  if (fields.collateralId) {
    form.append("collateral_id", fields.collateralId);
  }
  if (fields.guarantorId) {
    form.append("guarantor_id", fields.guarantorId);
  }

  try {
    const res = await fetch(
      `${getFalcoApiBaseUrl()}/customers/${encodeURIComponent(customerId)}/documents`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
        cache: "no-store",
      }
    );

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
      return {
        ok: false,
        response: NextResponse.json(
          {
            message:
              typeof err.message === "string"
                ? err.message
                : typeof o.message === "string"
                  ? o.message
                  : "Document upload failed",
            details: err.details ?? o.details,
          },
          { status: res.status }
        ),
      };
    }

    return { ok: true, data: data ?? { ok: true } };
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Could not reach the document service. Try a smaller file or try again.";
    return { ok: false, response: NextResponse.json({ message }, { status: 502 }) };
  }
}
