import { NextResponse } from "next/server";
import { extractWebhookEventsPayload } from "@/lib/webhook-event-adapters";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_VIEW_WEBHOOKS = new Set(["super_admin", "accountant"]);

/**
 * `GET /webhook-events?gateway=clickpesa&status=failed&from=&to=&page=&page_size=` — the failed
 * events list (and, more broadly, any status) for the Webhook Health screen.
 */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayView =
    MAY_VIEW_WEBHOOKS.has(auth.user.role) || auth.user.permissions?.includes("webhooks.manage");
  if (!mayView) {
    return NextResponse.json(
      { message: "You do not have permission to view webhook events." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const res = await falcoServerFetch<unknown>("/webhook-events", {
    request,
    query: {
      gateway: url.searchParams.get("gateway") ?? "clickpesa",
      status: url.searchParams.get("status") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: url.searchParams.get("page") ?? "1",
      page_size: url.searchParams.get("page_size") ?? "50",
    },
  });

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message: msg, error: msg, details: res.error.details },
      { status: res.error.status }
    );
  }

  const payload = extractWebhookEventsPayload(res.data);
  return NextResponse.json({ data: payload.events, events: payload.events, meta: payload.meta ?? null });
}
