import { NextResponse } from "next/server";
import { adaptApiWebhookHealth } from "@/lib/webhook-event-adapters";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_VIEW_WEBHOOKS = new Set(["super_admin", "accountant"]);

/**
 * `GET /webhook-events/health?gateway=clickpesa&hours=24|168` — received/processed/failed/pending
 * counts for the admin-only ClickPesa Webhook Health screen.
 */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayView =
    MAY_VIEW_WEBHOOKS.has(auth.user.role) || auth.user.permissions?.includes("webhooks.manage");
  if (!mayView) {
    return NextResponse.json(
      { message: "You do not have permission to view webhook health." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const res = await falcoServerFetch<unknown>("/webhook-events/health", {
    request,
    query: {
      gateway: url.searchParams.get("gateway") ?? "clickpesa",
      hours: url.searchParams.get("hours") ?? "24",
    },
  });

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message: msg, error: msg, details: res.error.details },
      { status: res.error.status }
    );
  }

  return NextResponse.json({ health: adaptApiWebhookHealth(res.data) });
}
