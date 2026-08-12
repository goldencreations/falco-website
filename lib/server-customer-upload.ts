import { NextResponse } from "next/server";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { falcoServerFetch, resolveFalcoAccessToken } from "@/lib/server-falco";
import { formatUploadHttpError } from "@/lib/upload-limits";

const BRANCH_CACHE_MS = 2 * 60 * 1000;
const branchCache = new Map<string, { branchId: string | undefined; expiresAt: number }>();

async function resolveCustomerBranchId(
  request: Request,
  customerId: string
): Promise<{ branchId: string | undefined } | { error: Response }> {
  const now = Date.now();
  const cached = branchCache.get(customerId);
  if (cached && now < cached.expiresAt) {
    return { branchId: cached.branchId };
  }

  const pre = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
    request,
  });
  if (!pre.ok) {
    return {
      error: NextResponse.json(
        { message: pre.error.message, details: pre.error.details },
        { status: pre.error.status }
      ),
    };
  }

  const row = extractCustomerDetail(pre.data);
  const branchId = row?.branch_id != null ? String(row.branch_id) : undefined;
  branchCache.set(customerId, { branchId, expiresAt: now + BRANCH_CACHE_MS });
  return { branchId };
}

/** Verify the user may access this customer (branch scope). */
export async function verifyCustomerUploadAccess(
  request: Request,
  customerId: string
): Promise<Response | null> {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const resolved = await resolveCustomerBranchId(request, customerId);
  if ("error" in resolved) return resolved.error;

  const denied = ensureResourceBranchAllowed(auth.user, resolved.branchId);
  if (denied) return denied;
  return null;
}

/** Proxy multipart file upload to a Falco customer sub-resource. */
export async function proxyCustomerMultipartUpload(
  request: Request,
  backendPath: string
): Promise<Response> {
  const token = await resolveFalcoAccessToken(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const incoming = await request.formData();
  const outbound = new FormData();
  for (const [key, value] of incoming.entries()) {
    if (value instanceof File) outbound.append(key, value, value.name);
    else outbound.append(key, value);
  }

  try {
    const res = await fetch(`${getFalcoApiBaseUrl()}${backendPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: outbound,
      cache: "no-store",
    });

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
      const rawMessage =
        typeof err.message === "string"
          ? err.message
          : typeof o.message === "string"
            ? o.message
            : "Upload failed";
      return NextResponse.json(
        {
          message: formatUploadHttpError(res.status, data, rawMessage),
          details: err.details ?? o.details,
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Could not reach the upload service. Try a smaller file or try again.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
