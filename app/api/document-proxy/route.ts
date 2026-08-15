import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth";
import { FalcoApiError, getAllowedDocumentProxyHostnames } from "@/lib/falco-api";
import { rewriteToConfiguredBackendUrl } from "@/lib/document-proxy";
import { resolveImageContentType } from "@/lib/media-content-type";

function getCookieValue(cookieHeader: string, name: string): string | null {
  const part = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!part) return null;
  return decodeURIComponent(part.slice(name.length + 1));
}

/**
 * Proxy route for authenticated document downloads.
 * The backend requires `Authorization: Bearer <token>` which browsers cannot
 * add automatically to <img src> or <a href>. This route reads the httpOnly
 * session cookie and forwards the request.
 *
 * Usage: GET /api/document-proxy?url={FALCO_API_BASE_URL}/documents/129
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = rewriteToConfiguredBackendUrl(targetUrl);
  } catch (e) {
    const message = e instanceof FalcoApiError ? e.message : "FALCO_API_BASE_URL is not configured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let parsed: URL;
  try {
    parsed = new URL(upstreamUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  let allowed: string[];
  try {
    allowed = getAllowedDocumentProxyHostnames();
  } catch (e) {
    const message = e instanceof FalcoApiError ? e.message : "FALCO_API_BASE_URL is not configured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!allowed.includes(parsed.hostname)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const token = getCookieValue(request.headers.get("cookie") ?? "", ACCESS_TOKEN_COOKIE_NAME);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Document server returned ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const declaredType = upstream.headers.get("content-type");
  const buffer = new Uint8Array(await upstream.arrayBuffer());
  const filenameHint =
    searchParams.get("name")?.trim() ||
    (() => {
      try {
        return decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
      } catch {
        return parsed.pathname.split("/").pop() ?? "";
      }
    })() ||
    (() => {
      const disposition = upstream.headers.get("content-disposition") ?? "";
      const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
      return match?.[1]?.replace(/"/g, "").trim() ?? "";
    })();
  const contentType = resolveImageContentType(declaredType, buffer, filenameHint);

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
  });
  // Inline display for <img> / View; keep filename if upstream provided one.
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) {
    const filenameMatch = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(contentDisposition);
    const filename = filenameMatch?.[1]?.replace(/"/g, "").trim();
    headers.set(
      "Content-Disposition",
      filename ? `inline; filename="${filename}"` : "inline"
    );
  } else if (contentType.startsWith("image/")) {
    headers.set("Content-Disposition", "inline");
  }
  headers.set("Content-Length", String(buffer.byteLength));

  return new NextResponse(buffer, { status: 200, headers });
}
