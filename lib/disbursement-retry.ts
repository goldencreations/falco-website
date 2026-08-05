/**
 * Pure helpers for the ClickPesa disbursement retry workflow.
 * Keep UI and network concerns thin; test these functions thoroughly.
 */

import { formatApiResponseError } from "@/lib/falco-api";

export const RETRY_CONFIRMATION_COPY =
  "Confirm in ClickPesa that this payout was not paid. Retrying will initiate a new payout and could cause a double payment if the original succeeded.";

export const RETRY_CHECKBOX_LABEL = "I confirmed this payout was not paid in ClickPesa.";

export const RETRY_SUBMITTED_MESSAGE = "Payout retry submitted.";
export const RETRY_ALREADY_SUBMITTED_MESSAGE = "This retry was already submitted.";

export type DisbursementRetryRow = {
  id: string;
  can_retry?: boolean;
  status?: string;
  order_reference?: string | null;
};

export type DisbursementRetrySuccess = {
  created: boolean;
  orderReference: string | null;
  message: string;
  disbursement: Record<string, unknown> | null;
};

/** Show “Retry payout” only when the backend explicitly allows it. */
export function canShowRetryPayout(row: Pick<DisbursementRetryRow, "can_retry">): boolean {
  return row.can_retry === true;
}

/** Confirm button stays disabled until the operator checks the acknowledgement. */
export function canSubmitDisbursementRetry(confirmedNotPaid: boolean, loading: boolean): boolean {
  return confirmedNotPaid === true && loading === false;
}

/**
 * Holds one idempotency key for a single reviewed retry action.
 * Generate on first confirm; reuse for network retries of the same action.
 * Clear when the dialog closes so the next reviewed action gets a new key.
 */
export class DisbursementRetryIdempotencySession {
  private key: string | null = null;

  constructor(private readonly createKey: () => string = createDisbursementRetryIdempotencyKey) {}

  /** Returns the stable key for this reviewed action (creates once). */
  getOrCreate(): string {
    if (!this.key) this.key = this.createKey();
    return this.key;
  }

  /** Exposed for tests — current key without creating. */
  peek(): string | null {
    return this.key;
  }

  /** Call when the user starts a completely new reviewed retry action. */
  reset(): void {
    this.key = null;
  }
}

export function createDisbursementRetryIdempotencyKey(
  now = Date.now(),
  randomPart = fallbackRandomPart()
): string {
  return `disb-retry-${now}-${randomPart}`;
}

function fallbackRandomPart(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function parseDisbursementRetrySuccess(json: unknown): DisbursementRetrySuccess {
  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const disbursement =
    o.disbursement && typeof o.disbursement === "object"
      ? (o.disbursement as Record<string, unknown>)
      : null;

  const created = o.created === true;
  const orderReference =
    firstNonEmpty(
      o.order_reference,
      disbursement?.order_reference,
      o.orderReference,
      disbursement?.orderReference
    ) || null;

  return {
    created,
    orderReference,
    message: created ? RETRY_SUBMITTED_MESSAGE : RETRY_ALREADY_SUBMITTED_MESSAGE,
    disbursement,
  };
}

export function formatDisbursementRetryValidationError(
  json: unknown,
  fallback = "Retry failed validation"
): string {
  return formatApiResponseError(json, fallback);
}

/**
 * Merge retry result into the console list without inventing a completed status.
 * Keeps the original reversed/rejected attempt and upserts the new attempt when present.
 */
export function mergeDisbursementRetryIntoList<T extends { id: string; status?: string }>(
  existing: T[],
  originalId: string,
  nextRow: T | null
): T[] {
  if (!nextRow) return existing;
  const withoutDup = existing.filter((row) => row.id !== nextRow.id);
  // Prefer placing the new attempt near the original for audit continuity.
  const originalIndex = withoutDup.findIndex((row) => row.id === originalId);
  if (originalIndex < 0) return [nextRow, ...withoutDup];
  const copy = [...withoutDup];
  copy.splice(originalIndex, 0, nextRow);
  return copy;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}
