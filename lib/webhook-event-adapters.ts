import type { WebhookEvent, WebhookEventStatus, WebhookHealthSummary } from "@/lib/types";

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asWebhookStatus(value: unknown): WebhookEventStatus {
  const s = str(value).toLowerCase();
  if (s === "processed" || s === "success" || s === "succeeded") return "processed";
  if (s === "failed" || s === "error") return "failed";
  if (s === "duplicate") return "duplicate";
  return "pending";
}

/** Human label for a `WebhookEventStatus`, matching the handoff spec's framing (duplicate ≠ failure). */
export function webhookEventStatusLabel(status: WebhookEventStatus): string {
  if (status === "processed") return "Processed";
  if (status === "failed") return "Failed";
  if (status === "duplicate") return "Duplicate";
  return "Pending";
}

export function adaptApiWebhookHealth(raw: unknown): WebhookHealthSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const inner =
    o.health && typeof o.health === "object"
      ? (o.health as Record<string, unknown>)
      : o.data && typeof o.data === "object" && !Array.isArray(o.data)
        ? (o.data as Record<string, unknown>)
        : o;
  const counts =
    inner.counts && typeof inner.counts === "object" ? (inner.counts as Record<string, unknown>) : undefined;
  return {
    received: num(inner.received ?? counts?.received),
    processed: num(inner.processed ?? counts?.processed),
    failed: num(inner.failed ?? counts?.failed),
    pending: num(inner.pending ?? counts?.pending),
    duplicate: num(inner.duplicate ?? counts?.duplicate),
    oldest_pending_at: str(inner.oldest_pending_at) || undefined,
  };
}

export function adaptApiWebhookEventRow(raw: Record<string, unknown>): WebhookEvent {
  const md =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : undefined;
  return {
    id: str(raw.id),
    gateway: str(raw.gateway ?? "clickpesa"),
    event_type: str(raw.event_type ?? raw.event ?? raw.type),
    event_reference: str(raw.event_reference ?? raw.reference ?? raw.paymentReference),
    status: asWebhookStatus(raw.status),
    received_at: str(raw.received_at ?? raw.created_at),
    processed_at: str(raw.processed_at) || undefined,
    error_message: str(raw.error_message ?? raw.error) || undefined,
    order_reference: str(md?.order_reference ?? raw.order_reference) || undefined,
    metadata: md,
  };
}

export function extractWebhookEventsPayload(json: unknown): {
  events: WebhookEvent[];
  meta?: { page?: number; page_size?: number; total?: number };
} {
  if (!json || typeof json !== "object") return { events: [] };
  const o = json as Record<string, unknown>;
  const rows = Array.isArray(o.data)
    ? o.data
    : Array.isArray(o.webhook_events)
      ? o.webhook_events
      : Array.isArray(o.events)
        ? o.events
        : [];
  const events = (rows as Record<string, unknown>[]).map(adaptApiWebhookEventRow);
  const meta =
    o.meta && typeof o.meta === "object" ? (o.meta as { page?: number; page_size?: number; total?: number }) : undefined;
  return { events, meta };
}
