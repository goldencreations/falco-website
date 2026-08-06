import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PaymentViewRow } from "./payment-adapters";
import type { WebhookEvent } from "./types";
import {
  buildPaymentReferenceSet,
  groupWebhookAttempts,
  hasAuthoritativePaymentsPage,
  resolutionLabelText,
} from "./webhook-audit-history";

function event(partial: Partial<WebhookEvent>): WebhookEvent {
  return {
    id: partial.id ?? "1",
    gateway: partial.gateway ?? "clickpesa",
    event_type: partial.event_type ?? "PAYMENT RECEIVED",
    event_reference: partial.event_reference ?? "REF-1",
    status: partial.status ?? "failed",
    received_at: partial.received_at ?? "2026-08-06T10:00:00Z",
    processed_at: partial.processed_at,
    error_message: partial.error_message,
    metadata: partial.metadata,
    order_reference: partial.order_reference,
  };
}

function payment(ref: string): PaymentViewRow {
  return {
    id: `p-${ref}`,
    payment_number: `PAY-${ref}`,
    loan_id: "loan-1",
    customer_id: "customer-1",
    amount: 1000,
    payment_method: "gateway",
    reference_number: ref,
    principal_allocated: 600,
    interest_allocated: 300,
    fees_allocated: 100,
    penalty_allocated: 0,
    status: "completed",
    payment_date: "2026-08-06",
    received_by: "system",
    created_at: "2026-08-06T10:10:00Z",
    metadata: { source: "clickpesa_webhook", gateway_payment_reference: ref },
  };
}

describe("webhook audit grouping", () => {
  it("groups attempts by gateway:event_reference", () => {
    const groups = groupWebhookAttempts(
      [
        event({ id: "1", event_reference: "A", status: "failed" }),
        event({ id: "2", event_reference: "A", status: "processed", received_at: "2026-08-06T11:00:00Z" }),
        event({ id: "3", event_reference: "B", status: "failed" }),
      ],
      [],
      { paymentsAuthoritative: false }
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0].key.includes(":"), true);
    assert.equal(groups[0].attempts.length >= 1, true);
  });

  it("marks resolved after failure when payment match exists", () => {
    const groups = groupWebhookAttempts(
      [event({ event_reference: "26807928218845", status: "failed" })],
      [payment("26807928218845")],
      { paymentsAuthoritative: false }
    );
    assert.equal(groups[0].resolution, "resolved_after_failure");
    assert.equal(groups[0].can_retry, false);
  });

  it("uses resolution not checked for partial payment data", () => {
    const groups = groupWebhookAttempts(
      [event({ event_reference: "X-1", status: "failed" })],
      [],
      { paymentsAuthoritative: false }
    );
    assert.equal(groups[0].resolution, "not_checked");
    assert.equal(groups[0].can_retry, false);
  });

  it("marks unresolved only when payment absence is authoritative", () => {
    const groups = groupWebhookAttempts(
      [event({ event_reference: "X-2", status: "failed" })],
      [],
      { paymentsAuthoritative: true }
    );
    assert.equal(groups[0].resolution, "unresolved");
    assert.equal(groups[0].can_retry, true);
  });
});

describe("payment reference matching and labels", () => {
  it("builds payment ref set from reference_number and gateway metadata", () => {
    const refs = buildPaymentReferenceSet([
      payment("R1"),
      { ...payment("R2"), reference_number: "", metadata: { gateway_payment_reference: "R2" } },
    ]);
    assert.equal(refs.has("R1"), true);
    assert.equal(refs.has("R2"), true);
  });

  it("checks payment list authority from meta.total", () => {
    assert.equal(hasAuthoritativePaymentsPage({ total: 100 }, 50), false);
    assert.equal(hasAuthoritativePaymentsPage({ total: 50 }, 50), true);
    assert.equal(hasAuthoritativePaymentsPage(undefined, 50), false);
  });

  it("uses conservative label text", () => {
    assert.equal(resolutionLabelText("resolved_after_failure"), "Resolved after failure");
    assert.equal(resolutionLabelText("unresolved"), "Unresolved receipt");
    assert.equal(resolutionLabelText("not_checked"), "Resolution not checked");
  });
});

