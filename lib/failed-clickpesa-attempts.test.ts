import { strict as assert } from "node:assert";
import { test } from "node:test";
import { failedAttemptDate, failedAttemptReason, failedClickPesaAttemptsUrl } from "./failed-clickpesa-attempts";
import { adaptApiWebhookEventRow } from "./webhook-event-adapters";

test("failed-attempt queries request provider failures, not processing failures", () => {
  const url = new URL(failedClickPesaAttemptsUrl("2026-10-28", "2026-10-28", 2), "https://falco.test");
  assert.equal(url.searchParams.get("event_type"), "PAYMENT FAILED");
  assert.equal(url.searchParams.get("status"), "processed");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("from"), "2026-10-28");
});

test("midnight attempts display on their EAT date and absent amounts stay unknown", () => {
  assert.match(failedAttemptDate("2026-10-27T21:10:35Z"), /28 Oct 2026, 00:10/);
  assert.equal(failedAttemptReason("insufficient_amount"), "Insufficient amount");
  const event = adaptApiWebhookEventRow({ id: "1", event_type: "PAYMENT FAILED", status: "processed", payment_attempt: {
    reference: "ATTEMPT-1", amount: null, reason: "insufficient_amount", currency: "TZS",
  } });
  assert.equal(event.payment_attempt?.amount, null);
  assert.equal(event.payment_attempt?.reference, "ATTEMPT-1");
});
