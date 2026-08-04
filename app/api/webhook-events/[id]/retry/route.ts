import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_MANAGE_WEBHOOKS = new Set(["super_admin", "accountant"]);

/**
 * `POST /webhook-events/{id}/retry` — re-queue a failed ClickPesa webhook event.
 * A successful call always means "queued for processing", not "processed" — the client should
 * show a pending state and refresh the row rather than assume the event is now resolved. A `409`
 * from the backend means the event is already resolved or currently processing; the client should
 * refresh instead of retrying again (surfaced as-is via the normal error branch below).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayRetry =
    MAY_MANAGE_WEBHOOKS.has(auth.user.role) || auth.user.permissions?.includes("webhooks.manage");
  if (!mayRetry) {
    return NextResponse.json(
      { message: "You do not have permission to retry webhook events." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Webhook event id is required" }, { status: 400 });
  }

  const res = await falcoServerFetch<unknown>(`/webhook-events/${encodeURIComponent(id)}/retry`, {
    method: "POST",
    request,
  });

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message: msg, error: msg, details: res.error.details },
      { status: res.error.status }
    );
  }

  return NextResponse.json(res.data ?? { message: "Retry queued" }, { status: 202 });
}
