import type { PaymentViewRow } from "@/lib/payment-adapters";
import type { WebhookEvent } from "@/lib/types";

export type ResolutionLabel = "resolved_after_failure" | "unresolved" | "not_checked";

export type ReceiptAttemptGroup = {
  key: string;
  gateway: string;
  event_reference: string;
  order_reference?: string;
  attempts: WebhookEvent[];
  latest: WebhookEvent;
  failed_attempts: number;
  has_failed_attempt: boolean;
  has_matching_payment: boolean;
  matching_payment_id?: string;
  resolution: ResolutionLabel;
  can_retry: boolean;
};

export function buildPaymentReferenceSet(payments: PaymentViewRow[]): Set<string> {
  const refs = new Set<string>();
  for (const p of payments) {
    addRef(refs, p.reference_number);
    addRef(refs, p.metadata?.gateway_payment_reference);
  }
  return refs;
}

export function hasAuthoritativePaymentsPage(meta?: { total?: number } | null, loadedCount = 0): boolean {
  if (!meta || meta.total == null) return false;
  return loadedCount >= Number(meta.total);
}

export function groupWebhookAttempts(
  events: WebhookEvent[],
  payments: PaymentViewRow[],
  options?: { paymentsAuthoritative?: boolean }
): ReceiptAttemptGroup[] {
  const refs = buildPaymentReferenceSet(payments);
  const paymentsByRef = new Map<string, string>();
  for (const p of payments) {
    const pid = p.id;
    const refCandidates = [p.reference_number, String(p.metadata?.gateway_payment_reference ?? "")];
    for (const c of refCandidates) {
      const ref = normalizeRef(c);
      if (ref && !paymentsByRef.has(ref)) paymentsByRef.set(ref, pid);
    }
  }

  const byKey = new Map<string, WebhookEvent[]>();
  for (const e of events) {
    const key = `${(e.gateway || "clickpesa").toLowerCase()}:${e.event_reference}`;
    const list = byKey.get(key) ?? [];
    list.push(e);
    byKey.set(key, list);
  }

  const groups: ReceiptAttemptGroup[] = [];
  for (const [key, attempts] of byKey.entries()) {
    const sorted = [...attempts].sort((a, b) => sortEventDateDesc(a, b));
    const latest = sorted[0];
    const hasFailed = sorted.some((a) => a.status === "failed");
    if (!hasFailed) continue;
    const ref = normalizeRef(latest.event_reference);
    const hasMatch = ref ? refs.has(ref) : false;
    const matchingPaymentId = ref ? paymentsByRef.get(ref) : undefined;
    const resolution: ResolutionLabel = hasMatch
      ? "resolved_after_failure"
      : options?.paymentsAuthoritative
        ? "unresolved"
        : "not_checked";

    groups.push({
      key,
      gateway: latest.gateway || "clickpesa",
      event_reference: latest.event_reference,
      order_reference:
        latest.order_reference ||
        normalizeRef(String(latest.metadata?.order_reference ?? "")) ||
        undefined,
      attempts: sorted,
      latest,
      failed_attempts: sorted.filter((a) => a.status === "failed").length,
      has_failed_attempt: true,
      has_matching_payment: hasMatch,
      matching_payment_id: matchingPaymentId,
      resolution,
      can_retry: latest.status === "failed" && resolution === "unresolved",
    });
  }

  return groups.sort((a, b) => sortEventDateDesc(a.latest, b.latest));
}

export function resolutionLabelText(label: ResolutionLabel): string {
  if (label === "resolved_after_failure") return "Resolved after failure";
  if (label === "unresolved") return "Unresolved receipt";
  return "Resolution not checked";
}

function sortEventDateDesc(a: Pick<WebhookEvent, "received_at" | "processed_at">, b: Pick<WebhookEvent, "received_at" | "processed_at">): number {
  const at = Date.parse(a.processed_at || a.received_at || "") || 0;
  const bt = Date.parse(b.processed_at || b.received_at || "") || 0;
  return bt - at;
}

function normalizeRef(value: unknown): string {
  const s = String(value ?? "").trim();
  return s;
}

function addRef(set: Set<string>, value: unknown) {
  const ref = normalizeRef(value);
  if (ref) set.add(ref);
}

