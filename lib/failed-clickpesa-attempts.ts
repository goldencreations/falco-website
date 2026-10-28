export function failedClickPesaAttemptsUrl(from: string, to: string, page: number): string {
  const query = new URLSearchParams({
    gateway: "clickpesa", event_type: "PAYMENT FAILED", status: "processed",
    page: String(page), page_size: "10",
  });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return `/api/webhook-events?${query}`;
}

export function failedAttemptDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function failedAttemptReason(value: string | null | undefined): string {
  const reason = value?.trim().replace(/_/g, " ");
  return reason ? reason[0].toUpperCase() + reason.slice(1) : "ClickPesa did not provide a reason";
}
