import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth";

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
 * Usage: GET /api/document-proxy?url=https://falcobackend.habitek.co.tz/documents/129
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Security: only proxy requests to the known backend domain
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const allowed = ["falcobackend.habitek.co.tz"];
  if (!allowed.includes(parsed.hostname)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const token = getCookieValue(request.headers.get("cookie") ?? "", ACCESS_TOKEN_COOKIE_NAME);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*",
      },
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

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
  });
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { status: 200, headers });
}
