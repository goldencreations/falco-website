import { NextResponse } from "next/server";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

export const CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE = "collateral_image";
export const CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE = "home_location_photo";
export const CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE = "business_location_photo";
export const CUSTOMER_GUARANTOR_ID_FRONT_DOCUMENT_TYPE = "guarantor_id_front";
export const CUSTOMER_GUARANTOR_ID_BACK_DOCUMENT_TYPE = "guarantor_id_back";

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

export async function uploadCustomerDocument(
  request: Request,
  customerId: string,
  fields: {
    file: File;
    type: string;
    name: string;
    collateralId?: string;
    guarantorId?: string;
  }
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const token = await resolveFalcoAccessToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const form = new FormData();
  form.append("file", fields.file, fields.file.name);
  form.append("type", fields.type);
  form.append("name", fields.name);
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
