import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptApiDisbursementRow } from "./disbursement-adapters";
import {
  canShowRetryPayout,
  canSubmitDisbursementRetry,
  createDisbursementRetryIdempotencyKey,
  DisbursementRetryIdempotencySession,
  formatDisbursementRetryValidationError,
  mergeDisbursementRetryIntoList,
  parseDisbursementRetrySuccess,
  RETRY_ALREADY_SUBMITTED_MESSAGE,
  RETRY_CHECKBOX_LABEL,
  RETRY_CONFIRMATION_COPY,
  RETRY_SUBMITTED_MESSAGE,
} from "./disbursement-retry";

describe("can_retry button visibility", () => {
  it("shows Retry payout only when can_retry === true", () => {
    assert.equal(canShowRetryPayout({ can_retry: true }), true);
    assert.equal(canShowRetryPayout({ can_retry: false }), false);
    assert.equal(canShowRetryPayout({}), false);
    assert.equal(canShowRetryPayout({ can_retry: undefined }), false);
  });

  it("maps can_retry from API rows", () => {
    const withRetry = adaptApiDisbursementRow({
      id: "1",
      loan_id: "10",
      amount: 1000,
      status: "rejected",
      can_retry: true,
      method: "mpesa",
    });
    const withoutRetry = adaptApiDisbursementRow({
      id: "2",
      loan_id: "10",
      amount: 1000,
      status: "rejected",
      can_retry: false,
      method: "mpesa",
    });
    assert.equal(withRetry.can_retry, true);
    assert.equal(canShowRetryPayout(withRetry), true);
    assert.equal(withoutRetry.can_retry, undefined);
    assert.equal(canShowRetryPayout(withoutRetry), false);
  });
});

describe("confirmation requirement", () => {
  it("exposes the required warning and checkbox copy", () => {
    assert.match(RETRY_CONFIRMATION_COPY, /double payment/);
    assert.equal(RETRY_CHECKBOX_LABEL, "I confirmed this payout was not paid in ClickPesa.");
  });

  it("blocks submit until confirmed_not_paid is checked", () => {
    assert.equal(canSubmitDisbursementRetry(false, false), false);
    assert.equal(canSubmitDisbursementRetry(true, false), true);
  });
});

describe("stable idempotency key", () => {
  it("generates a unique key shape", () => {
    assert.equal(createDisbursementRetryIdempotencyKey(1, "abc"), "disb-retry-1-abc");
  });

  it("reuses the same key for network retries of one reviewed action", () => {
    const session = new DisbursementRetryIdempotencySession(() => "stable-key-1");
    assert.equal(session.getOrCreate(), "stable-key-1");
    assert.equal(session.getOrCreate(), "stable-key-1");
    assert.equal(session.peek(), "stable-key-1");
  });

  it("issues a new key only after a completely new reviewed retry action", () => {
    let n = 0;
    const session = new DisbursementRetryIdempotencySession(() => `key-${++n}`);
    assert.equal(session.getOrCreate(), "key-1");
    // Simulate timeout / failed response — still same reviewed action
    assert.equal(session.getOrCreate(), "key-1");
    session.reset();
    assert.equal(session.getOrCreate(), "key-2");
  });
});

describe("duplicate HTTP submission (idempotent 202)", () => {
  it("treats created=false as already submitted", () => {
    const parsed = parseDisbursementRetrySuccess({
      created: false,
      order_reference: "DISB-21-2",
    });
    assert.equal(parsed.created, false);
    assert.equal(parsed.message, RETRY_ALREADY_SUBMITTED_MESSAGE);
    assert.equal(parsed.orderReference, "DISB-21-2");
  });
});

describe("HTTP 202 created true/false", () => {
  it("shows submitted message when created is true", () => {
    const parsed = parseDisbursementRetrySuccess({
      created: true,
      disbursement: { id: "99", order_reference: "DISB-21-3", status: "processing" },
    });
    assert.equal(parsed.created, true);
    assert.equal(parsed.message, RETRY_SUBMITTED_MESSAGE);
    assert.equal(parsed.orderReference, "DISB-21-3");
  });

  it("shows already-submitted message when created is false", () => {
    const parsed = parseDisbursementRetrySuccess({ created: false, order_reference: "DISB-21-2" });
    assert.equal(parsed.message, RETRY_ALREADY_SUBMITTED_MESSAGE);
  });
});

describe("HTTP 422 errors", () => {
  it("surfaces backend validation messages clearly", () => {
    const message = formatDisbursementRetryValidationError({
      message: "The given data was invalid.",
      details: [{ field: "confirmed_not_paid", message: "Must be true." }],
    });
    assert.match(message, /confirmed_not_paid/);
    assert.match(message, /Must be true/);
  });

  it("formats Laravel-style errors", () => {
    const message = formatDisbursementRetryValidationError({
      message: "Validation failed",
      errors: { confirmed_not_paid: ["Confirmation is required"] },
    });
    assert.match(message, /Confirmation is required/);
  });
});

describe("disabled loading state", () => {
  it("disables submit while the request is running", () => {
    assert.equal(canSubmitDisbursementRetry(true, true), false);
    assert.equal(canSubmitDisbursementRetry(true, false), true);
  });
});

describe("audit history and completed status", () => {
  it("keeps the original reversed attempt when inserting the new attempt", () => {
    const existing = [
      { id: "old", status: "rejected" },
      { id: "other", status: "completed" },
    ];
    const merged = mergeDisbursementRetryIntoList(existing, "old", {
      id: "new",
      status: "processing",
    });
    assert.deepEqual(
      merged.map((r) => r.id),
      ["new", "old", "other"]
    );
    assert.equal(merged.find((r) => r.id === "old")?.status, "rejected");
  });

  it("does not invent completed status for a retry row", () => {
    const adapted = adaptApiDisbursementRow({
      id: "new",
      loan_id: "10",
      amount: 500,
      status: "processing",
      gateway: "clickpesa",
      order_reference: "DISB-1-2",
      method: "mpesa",
    });
    assert.equal(adapted.status, "processing");
    assert.notEqual(adapted.status, "completed");
  });
});
